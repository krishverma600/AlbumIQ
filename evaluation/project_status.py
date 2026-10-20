"""Read-only snapshots and search replay for the live AlbumIQ evaluation notebook."""
from pathlib import Path
import os
import sys
import time
import numpy as np
import pandas as pd


def connect():
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root / 'backend'))
    from dotenv import load_dotenv
    load_dotenv(root / 'backend/.env')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    # Notebook kernels run an event loop; isolate sync Django access to a worker
    # rather than disabling Django's async safety checks.
    import django
    django.setup()
    from django.conf import settings
    database = settings.DATABASES['default']
    if os.getenv('POSTGRES_HOST') and database['ENGINE'].endswith('sqlite3'):
        raise RuntimeError(
            'This kernel already loaded SQLite before backend/.env. '
            'Restart the notebook kernel and run step 1 again; do not migrate the wrong database.'
        )
    print('Database backend:', database['ENGINE'].rsplit('.', 1)[-1])
    print('Database:', database['NAME'])
    return root


def database_call(function, *args, **kwargs):
    from concurrent.futures import ThreadPoolExecutor
    from django.db import connections
    def work():
        try:
            return function(*args, **kwargs)
        finally:
            connections.close_all()
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(work).result()


def snapshot(event_code=None):
    from apps.events.models import Event
    from apps.photos.models import Photo
    from apps.search.models import GuestSearch
    from apps.face_engine.models import FaceEmbedding
    from apps.face_engine.services import embedding_model_key, matching_threshold
    from django.utils.timezone import now
    # Snapshot is read-only; no search or matched_count is updated.
    events = Event.objects.all()
    if event_code:
        events = events.filter(event_code=event_code)
        if not events.exists():
            raise ValueError(f'No event found with code {event_code!r}.')
    ids = list(events.values_list('pk', flat=True))
    photos = pd.DataFrame(list(Photo.objects.filter(event_id__in=ids).values(
        'id', 'event__event_code', 'processing_status', 'uploaded_at')),
        columns=['id', 'event__event_code', 'processing_status', 'uploaded_at'])
    searches = pd.DataFrame(list(GuestSearch.objects.filter(event_id__in=ids).values(
        'id', 'event__event_code', 'search_time', 'matched_count')),
        columns=['id', 'event__event_code', 'search_time', 'matched_count'])
    if not searches.empty:
        searches['id'] = searches.id.astype(str)
    embeddings = FaceEmbedding.objects.filter(photo__event_id__in=ids, embedding_model=embedding_model_key(), photo__processing_status='COMPLETED')
    searchable = set(embeddings.values_list('photo_id', flat=True))
    n, q = len(photos), len(searches)
    status_counts = photos.processing_status.value_counts() if n else pd.Series(dtype=int)
    def percentage(count, total):
        return 100 * count / total if total else np.nan
    definitions = [
        ('Completed processing', int(status_counts.get('COMPLETED', 0)), n, 'Processed photo status; does not prove identity correctness.'),
        ('Searchable photos', len(searchable), n, 'Completed photos with embeddings from the active model.'),
        ('No face detected', int(status_counts.get('NO_FACES', 0)), n, 'Photo status only; not detector error without reviewed truth.'),
        ('Processing failed', int(status_counts.get('FAILED', 0)), n, 'Failed uploads/processing among stored photos.'),
        ('Processing pending', sum(int(status_counts.get(s, 0)) for s in ('IMPORTING','QUEUED','PROCESSING')), n, 'Stored photos still waiting or processing.'),
        ('Recorded searches with results', int((searches.matched_count > 0).sum()) if q else 0, q, 'Last stored matched_count > 0; not verified recognition accuracy.'),
        ('Recorded searches without results', int((searches.matched_count == 0).sum()) if q else 0, q, 'Zero may mean no match OR a rejected/interrupted search; success is not logged separately.'),
    ]
    metrics = pd.DataFrame([{'Metric':name,'Count':count,'Total':total,'Percentage (%)':percentage(count,total),'Meaning':meaning} for name,count,total,meaning in definitions])
    per_event = []
    for event in events:
        p = photos[photos.event__event_code == event.event_code]
        s = searches[searches.event__event_code == event.event_code]
        per_event.append({'Event':event.event_code,'Photos':len(p),'Searchable':sum(pid in searchable for pid in p.id),
                          'Recorded searches':len(s),'Searches with results':int((s.matched_count>0).sum()),
                          'Stored returned-photo total':int(s.matched_count.sum())})
    return {'captured_at':now().isoformat(),'model':embedding_model_key(),'threshold':matching_threshold(),
            'events':pd.DataFrame(per_event),'photos':photos,'searches':searches,'metrics':metrics,
            'current_embeddings':embeddings.count()}


def replay(event_code=None, limit=3):
    """Re-extract stored website selfies; search current gallery without saving anything."""
    from apps.search.models import GuestSearch
    from apps.face_engine.models import FaceEmbedding
    from apps.photos.models import Photo
    from apps.face_engine.services import local_image_path, extract_embeddings, find_matches, embedding_model_key, matching_threshold
    searches = GuestSearch.objects.select_related('event').order_by('-search_time')
    if event_code:
        searches = searches.filter(event__event_code=event_code)
    rows, query_rows, galleries = [], [], {}
    for search in searches[:limit]:
        sid = str(search.pk)
        started = time.perf_counter()
        gallery_ids = set(Photo.objects.filter(event=search.event).values_list('pk',flat=True))
        galleries[sid] = gallery_ids
        try:
            with local_image_path(search.selfie) as path:
                faces = extract_embeddings(path)
            if len(faces) != 1:
                raise ValueError(f'Reference requires exactly one detected face, found {len(faces)}.')
            candidates = list(FaceEmbedding.objects.filter(photo__event=search.event,
                photo__processing_status='COMPLETED', embedding_model=embedding_model_key()))
            best = {}
            for match in find_matches(faces[0].embedding_vector, candidates, matching_threshold()):
                best.setdefault(match['embedding'].photo_id, match['distance'])
            for rank, (photo_id, distance) in enumerate(best.items(), 1):
                rows.append({'search_id':sid,'event':search.event.event_code,'rank':rank,
                             'photo_id':photo_id,'distance':distance})
            query_rows.append({'search_id':sid,'event':search.event.event_code,'stored_matches':search.matched_count,
                               'current_matches':len(best),'status':'OK','elapsed_ms':(time.perf_counter()-started)*1000})
        except Exception as exc:
            query_rows.append({'search_id':sid,'event':search.event.event_code,'stored_matches':search.matched_count,
                               'current_matches':None,'status':f'{type(exc).__name__}: {exc}',
                               'elapsed_ms':(time.perf_counter()-started)*1000})
    return (pd.DataFrame(query_rows,columns=['search_id','event','stored_matches','current_matches','status','elapsed_ms']),
            pd.DataFrame(rows,columns=['search_id','event','rank','photo_id','distance']), galleries)


def reviewed_accuracy(queries, matches, galleries, truth):
    """Truth maps search UUID to ALL relevant photo IDs in its current event gallery."""
    rows=[]
    for sid, relevant_ids in truth.items():
        selected=queries[queries.search_id==sid]
        if selected.empty:
            raise ValueError(f'Search {sid} is not in the replay. Increase SEARCH_LIMIT or select its event.')
        relevant=set(map(int,relevant_ids)); gallery=galleries[sid]
        if not relevant.issubset(gallery):
            raise ValueError(f'{sid}: annotated photo IDs must belong to its event.')
        if not gallery:
            raise ValueError(f'{sid}: empty gallery cannot measure photo classification accuracy.')
        ok=selected.iloc[0]['status']=='OK'
        predicted=set(matches.loc[matches.search_id==sid,'photo_id']) if ok else set()
        tp=len(predicted & relevant); fp=len(predicted-relevant)
        fn=len(relevant-predicted); tn=len(gallery-(predicted|relevant))
        ratio=lambda a,b:100*a/b if b else np.nan
        rows.append({'search_id':sid,'Gallery photos':len(gallery),'Relevant photos':len(relevant),
                     'TP':tp,'FP':fp,'FN':fn,'TN':tn,'Query processed':ok,
                     'Photo decision accuracy (%)':ratio(tp+tn,len(gallery)) if ok else 0.,
                     'Precision (%)':ratio(tp,tp+fp) if ok else np.nan,
                     'Recall (%)':ratio(tp,tp+fn), 'F1 (%)':ratio(2*tp,2*tp+fp+fn),
                     'Specificity (%)':ratio(tn,tn+fp) if ok else np.nan})
    return pd.DataFrame(rows)


def review_page(search_id, page=1, page_size=12):
    """Return reference and one album page for human review, without writing files."""
    from apps.search.models import GuestSearch
    from apps.photos.models import Photo
    from PIL import Image, ImageOps
    search=GuestSearch.objects.get(pk=search_id)
    def thumbnail(field):
        try:
            with field.open('rb') as stream:
                image=ImageOps.exif_transpose(Image.open(stream)).convert('RGB')
                image.thumbnail((360,280))
                return image.copy()
        except Exception:
            return None
    photos=Photo.objects.filter(event=search.event).order_by('pk')
    items=[('Reference selfie',thumbnail(search.selfie))]
    for photo in photos[(page-1)*page_size:page*page_size]:
        items.append((f'Photo ID {photo.pk}',thumbnail(photo.image)))
    return items, photos.count()
