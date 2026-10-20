"""Manual AI check: python test_ai.py [image_path]."""
if __name__ == "__main__":
    import os
    import sys
    import django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
    from apps.face_engine.services import embedding_model_key, extract_embeddings
    faces = extract_embeddings(sys.argv[1] if len(sys.argv) > 1 else "test.jpg")
    print("Model:", embedding_model_key())
    print("Faces:", len(faces), "Embedding dimensions:", [len(face.embedding_vector) for face in faces])
