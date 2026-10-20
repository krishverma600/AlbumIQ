from django.core.management.base import BaseCommand
from apps.photos.models import Photo
from apps.photos.tasks import process_photo_embeddings


class Command(BaseCommand):
    help = 'Rebuild face embeddings for existing photos with the configured model.'

    def add_arguments(self, parser):
        parser.add_argument('--event-code')
        parser.add_argument('--sync', action='store_true', help='Process locally without a Celery broker.')

    def handle(self, *args, **options):
        photos = Photo.objects.all()
        if options['event_code']:
            photos = photos.filter(event__event_code=options['event_code'])
        for photo in photos.iterator():
            if options['sync']:
                process_photo_embeddings.run(str(photo.pk))
            else:
                process_photo_embeddings.delay(str(photo.pk))
            self.stdout.write(f'Processed or queued photo {photo.pk}')
