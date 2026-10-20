# AI Wedding Photo Finder System

A production-minded starter monorepo for an AI-powered wedding gallery search platform. The scaffold follows the HLD/LLD you shared and includes:

- A Django REST backend for admin authentication, event management, photo uploads, and guest selfie search
- A React + Tailwind frontend for the admin dashboard and guest portal
- Celery + Redis wiring for background face processing
- Local-media storage defaults with clear extension points for Cloudinary or S3

## Project Structure

```text
AI Wedding Photo Finder System/
├── backend/
│   ├── apps/
│   │   ├── events/
│   │   ├── face_engine/
│   │   ├── photos/
│   │   ├── search/
│   │   └── users/
│   ├── config/
│   ├── .env.example
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
└── docker-compose.yml
```

## Backend Highlights

- JWT-based admin authentication
- Event creation with generated event code and QR asset
- Bulk photo upload endpoint
- Celery task stub for extracting face embeddings
- Guest selfie search endpoint with Euclidean-distance matching

## Frontend Highlights

- Admin login, dashboard, event creation, upload, and analytics placeholders
- Guest event entry, QR scanner panel, selfie upload, and result gallery
- Shared API services ready to point at the Django backend

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Setup

- Copy `backend/.env.example` to `backend/.env`
- Copy `frontend/.env.example` to `frontend/.env`
- If you are not using Docker, change `POSTGRES_HOST` from `db` to `localhost`
- Leave the Postgres variables blank only if you want the backend to fall back to SQLite during local experiments
- Install `backend/requirements-ai.txt` only on machines where native `dlib` builds are supported

## Next Recommended Steps

1. Install dependencies and run migrations
2. Connect the photo pipeline to Cloudinary or S3
3. Replace JSON embeddings with `pgvector` or FAISS for faster production search
4. Add analytics endpoints for guest search trends

## Face search workflow

Photographer uploads are scoped to an owned event. A Celery worker detects every face and
stores a trained identity embedding for each face, with the model identifier. Guest search
requires exactly one face in the selfie and returns only photos from that event containing
a matching face. Group photos are returned when the guest appears in them; results are
whole photos, not cropped faces. Recognition is threshold-based and should be validated on
your own wedding images before deployment.

Use `FACE_ENGINE_PROVIDER=deepface` with `DEEPFACE_MODEL=ArcFace` and `DEEPFACE_DETECTOR_BACKEND=yunet`, or
`FACE_ENGINE_PROVIDER=face_recognition`. `auto` selects an installed trained provider.
Install `backend/requirements-ai-deepface.txt` for ArcFace, or `backend/requirements-ai.txt` for both providers. Pixel-based OpenCV matching is
disabled. YuNet detects faces; ArcFace generates identity embeddings. EXIF orientation and sideways camera images are handled before matching.
Keep the same provider/model/detector settings on the API and workers. Model weights must
be available to each worker (the first use may download them).

After updating, from `backend/` with its virtual environment active:

```bash
python manage.py migrate
python manage.py reprocess_photos --sync
```

The second command rebuilds existing photos, including legacy embeddings excluded from new
searches. Use `--event-code WED-XXXX` to limit it to an event. Omit `--sync` to queue work
on Celery. Start Redis and a worker for normal asynchronous uploads:

```bash
celery -A config worker -l info
```

For local development without Redis, set `CELERY_TASK_ALWAYS_EAGER=True`; extraction then
runs during the upload request. For large albums, use the background worker.

Local filesystem storage is the default. Set `USE_S3=True` and configure AWS variables to
use S3 after installing the backend requirements. Both extraction and selfie matching read
through Django storage, so they also support remote files.

Run the isolated regression suite without modifying your configured database:

```bash
python manage.py test apps.search --settings=config.test_settings
```

For a physical mobile device, set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN address
or deployed API URL; add that hostname to Django's allowed hosts. The API must be reachable
from the phone.

Docker installs ArcFace dependencies automatically and shares cached model weights between the API and worker. Run `docker compose up --build` with Docker Desktop running. Database migrations run before the API starts.

## Import photos from Google Drive

Photographers can use **Import from Google Drive** on the web or mobile photo-upload
screen alongside local uploads. Select a wedding and paste individual Google Drive photo
links, one per line. Share each file with **Anyone with the link** and enable downloading.
Up to 20 links can be submitted per batch; each photo can be up to 20 MB. Duplicate file
links within a batch are imported once. Folder links and private-account browsing are
not supported by this shared-link option. No Google Cloud credentials are required.

The authenticated `POST /api/photos/import-drive/` endpoint accepts
`{"event_code":"WED-XXXX","links":["https://drive.google.com/file/d/FILE_ID/view"]}`.
It queues each download in Celery, saves the image to the selected event, and queues the
existing face-embedding task. The upload list polls progress through `IMPORTING`, `QUEUED`,
`PROCESSING`, and `COMPLETED`. Failed imports display the reason so the photographer can
correct sharing settings and submit again. Google quotas and download restrictions can
prevent an otherwise shared file from downloading. Restart existing API and Celery worker
processes after updating, and run `python manage.py migrate`.

Drive imports have regression coverage:

```bash
python manage.py test apps.photos apps.search --settings=config.test_settings
```

## Matching threshold and live selfies

Guest search supports a browser webcam preview with explicit capture, as well as uploaded
reference photos. Mobile guests can also launch their front camera. Camera frames are sent
only after capture. Browser camera access requires localhost or HTTPS and user permission.

Leave `FACE_MATCH_THRESHOLD` blank to use the active model's recommended threshold.
DeepFace embeddings are L2-normalized, so matching uses its `euclidean_l2` threshold
(ArcFace: 1.13), rather than an unrelated 0.45 cutoff. Explicit overrides are supported
for validation on your own dataset. The model thresholds come from
[DeepFace's threshold configuration](https://github.com/serengil/deepface/blob/master/deepface/config/threshold.py).
Filenames are never used to decide matches. The gallery starts a new search when opened
with a selected reference image instead of reusing a previous result list.

YuNet face-detection confidence defaults to `YUNET_SCORE_THRESHOLD=0.8` to improve
coverage for smaller and angled faces. This is independent of the identity-match
threshold. A processed image with no detected faces is marked `NO_FACES`, with an
explanation in the photographer's queue. Search responses include `album_status`
counts so guests can distinguish pending processing from an album with no accepted
match. A guest reference photo is never automatically added to an event album.

## Photo browsing and QR access

The photographer photo manager and guest gallery show 12 thumbnails per page, with
filename search, selection, and a **View all photos** option. Original photos fit inside
their preview rather than being cropped. The preview opens above the page, fits the
viewport, locks background scrolling, and supports Escape, arrow keys, and downloads.

**Download** saves an individual original photo. **Download all** and **Download selected**
create a ZIP with unique filenames. Large archives can be downloaded in smaller selections.
The event access page supports both live QR scanning and uploading a saved QR image.
Only an event code is read from the QR; external QR URLs are never followed automatically.

Run frontend interaction tests with `npm test` inside `frontend/`. They cover QR decoding,
upload, camera stream cleanup, permissions, blob downloads, ZIP contents, preview scroll
locking, and photo pagination/selection. Physical-camera and final visual checks still
require a connected browser.

### Research evaluation

Open [evaluation/model_accuracy.ipynb](evaluation/model_accuracy.ipynb) in VS Code to read current website activity, replay stored selfies, and display inline graphs. Add reviewed relevant photo IDs to measure recognition accuracy on those searches. See [evaluation/README.md](evaluation/README.md). No output directory is created.
