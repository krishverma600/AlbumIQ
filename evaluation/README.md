# Evaluation synchronized with the website

Open **model_accuracy.ipynb** in VS Code and select the **backend/.venv/bin/python** kernel. Start your normal project database first. Run cells from top to bottom.

- Steps 1–3 read current database events, photos, face-processing status and stored search counts, then display seven operational percentage metrics and graphs.
- Step 4 replays the latest stored website selfies against their current event albums, using the production embedding functions and threshold. Set `EVENT_CODE` to filter an event, and `SEARCH_LIMIT` to select more searches. This does not save searches or update stored counts.
- Step 5 displays a stored selfie and paginated album thumbnails labeled with photo IDs. Change `PAGE` to inspect the complete album.
- Step 6 accepts `GROUND_TRUTH`: a dictionary mapping a real search UUID to **every** photo ID containing that person in the event. It calculates accuracy, precision, recall, F1 and specificity for reviewed searches. An empty list means you verified the person is absent from the entire album.
- Step 7 graphs those verified scores and confusion counts.

Re-run steps 2–4 after using the website to refresh the snapshot. Re-review labels if album contents change. Nothing is written to an output folder or to the application database. Save the notebook to keep your displayed results.

Operational processing/search rates are not recognition accuracy. Search counts alone cannot show whether returned people are correct or identify missed photos. Stored searches have no historical result IDs, completed/error flag or latency, so replays show current behavior, not exact historical outcomes. A zero stored count can also indicate a rejected/interrupted search.

The helper **project_status.py** runs synchronous Django access in a worker thread so it works safely inside Jupyter's event loop. The original **model_accuracy.py** remains an optional manually labeled pair-test script; the notebook now evaluates current project activity instead.

Dependencies: `backend/.venv/bin/python -m pip install -r evaluation/requirements.txt`. Install Microsoft's Python and Jupyter VS Code extensions to display the notebook cells.

If you previously saw `no such column: face_engine_faceembedding.embedding_model`, restart the notebook kernel and run from step 1. Environment loading now explicitly uses `backend/.env`, and step 1 prints the selected database backend. An old kernel retains its previous SQLite configuration until restarted; do not migrate that fallback database merely to hide this error when your website uses PostgreSQL.
