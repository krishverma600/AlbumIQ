# %% [markdown]
# # AlbumIQ — Face recognition accuracy (%)
# Select **backend/.venv/bin/python** in VS Code, then click **Run Cell** above each cell.
# Install the VS Code Python and Jupyter extensions to see tables/graphs inline.
# Run cells in order. No reports or output folders are written.
#
# Evaluate independently labeled pairs of DIFFERENT photos. Include both matching
# and nonmatching people, multiple people, and varied conditions. Do not choose
# labels from filenames, similarity scores, or the model's predictions.
# The production threshold is evaluated as-is; do not tune it on this test set.

# %% 1. Imports and existing AlbumIQ model
from pathlib import Path
import hashlib
import os
import sys
import time

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, roc_curve, roc_auc_score

# Works from the project root or evaluation/ in VS Code's interactive window.
PROJECT_ROOT = Path.cwd().resolve()
while not (PROJECT_ROOT / 'backend/config/settings.py').exists():
    if PROJECT_ROOT == PROJECT_ROOT.parent:
        raise RuntimeError('Open the AlbumIQ project folder in VS Code first.')
    PROJECT_ROOT = PROJECT_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.core.files import File
from apps.face_engine.services import (
    extract_embeddings, local_image_path, matching_threshold,
    embedding_model_key, euclidean_distance,
)

THRESHOLD = matching_threshold()
print('Model:', embedding_model_key())
print(f'Accept when Euclidean distance <= {THRESHOLD:.4f}')
print('Uses the existing model, preprocessing, normalization and rotation recovery.')

# %% 2. YOUR TEST DATA — edit this cell before running the following cells
# One row = reference photo + album photo + independently verified answer.
# same_person=True: reference person appears anywhere in the album photo.
# same_person=False: reference person does NOT appear in the album photo.
# Reference images must contain one person. Album images may contain several.
# Paths can be absolute or relative to the AlbumIQ project root.
# Replace the commented examples with REAL paths and HUMAN-VERIFIED labels.
PAIRS = [
    # {'reference': 'test_photos/person_a_selfie.jpg',
    #  'photo': 'test_photos/person_a_wedding.jpg', 'same_person': True},
    # {'reference': 'test_photos/person_a_selfie.jpg',
    #  'photo': 'test_photos/person_b_wedding.jpg', 'same_person': False},
]

# Optional: load your own CSV instead of entering PAIRS above.
# CSV columns: reference,photo,same_person (labels must be true/false or 1/0).
PAIRS_CSV = None  # e.g. 'evaluation/my_labeled_pairs.csv'

pairs = pd.read_csv(PROJECT_ROOT / PAIRS_CSV) if PAIRS_CSV else pd.DataFrame(PAIRS)
if pairs.empty:
    raise ValueError('Add labeled photo pairs in PAIRS, or set PAIRS_CSV. Accuracy cannot be measured without correct answers.')
required = {'reference', 'photo', 'same_person'}
if not required.issubset(pairs.columns):
    raise ValueError(f'Required columns: {sorted(required)}')

def verified_label(value):
    normalized = str(value).strip().lower()
    if normalized in ('true', '1'): return True
    if normalized in ('false', '0'): return False
    raise ValueError(f'Invalid same_person label: {value!r}; use true/false or 1/0.')

pairs['same_person'] = pairs['same_person'].map(verified_label)
if pairs['same_person'].nunique() < 2:
    raise ValueError('Include BOTH matching and nonmatching pairs for a meaningful accuracy test.')

def image_path(value):
    path = (PROJECT_ROOT / str(value)).resolve()
    if not path.is_file(): raise FileNotFoundError(f'Image not found: {path}')
    return path

# Prevent exact copies from inflating recognition performance.
seen_pairs = set()
for row in pairs.itertuples():
    a, b = image_path(row.reference), image_path(row.photo)
    hashes = tuple(hashlib.sha256(p.read_bytes()).hexdigest() for p in (a, b))
    if hashes[0] == hashes[1]:
        raise ValueError(f'Row {row.Index}: reference and album photo are identical. Use different captures.')
    pair_key = tuple(sorted(hashes))
    if pair_key in seen_pairs:
        raise ValueError(f'Row {row.Index}: duplicate/reversed test pair.')
    seen_pairs.add(pair_key)
print(f'Test pairs: {len(pairs)} | Matching: {pairs.same_person.sum()} | Nonmatching: {(~pairs.same_person).sum()}')
print('Use independent captures; manually remove re-encoded/near-duplicate images too.')
print(pairs[['same_person']].value_counts().rename('pair_count').to_string())

# %% 3. Extract real face embeddings and evaluate each pair
# A cache avoids repeatedly extracting the same image. This is pair verification,
# not a full-album retrieval benchmark. No database rows are changed.
cache = {}

def faces_for(path):
    key = str(path)
    if key not in cache:
        try:
            with path.open('rb') as stream:
                with local_image_path(File(stream, name=path.name)) as prepared:
                    cache[key] = (extract_embeddings(prepared), '')
        except Exception as exc:
            cache[key] = ([], f'{type(exc).__name__}: {exc}')
    return cache[key]

records = []
start = time.perf_counter()
for number, row in enumerate(pairs.itertuples(), start=1):
    references, reference_error = faces_for(image_path(row.reference))
    photos, photo_error = faces_for(image_path(row.photo))
    error = reference_error or photo_error
    if not error and len(references) != 1:
        error = f'Reference needs exactly one detected face; found {len(references)}.'
    if not error and not photos:
        error = 'No face detected in album photo.'
    distance = np.nan
    prediction = None
    if not error:
        # A group photograph matches if ANY detected face matches the reference.
        distance = min(euclidean_distance(references[0].embedding_vector, face.embedding_vector) for face in photos)
        prediction = distance <= THRESHOLD
    records.append({'pair': number, 'actual_match': bool(row.same_person),
                    'predicted_match': prediction, 'distance': distance,
                    'correct': not error and prediction == bool(row.same_person),
                    'status': error or 'OK'})
    print(f'Pair {number}/{len(pairs)}: ' + ('CORRECT' if records[-1]['correct'] else 'FAILED / INCORRECT'))
results = pd.DataFrame(records)
elapsed = time.perf_counter() - start
print('\nPer-pair results (lower distance means more similar):')
print(results.to_string(index=False))
print(f'Elapsed: {elapsed:.2f} s; unique images processed: {len(cache)}. Includes first model load and cache reuse.')

# %% 4. Seven numerical metrics in PERCENTAGE
# Primary accuracy counts extraction failures as incorrect, even on negative pairs.
# This avoids rewarding the model for failing to detect a person.
valid = results[results.status == 'OK'].copy()
if valid.empty:
    raise RuntimeError('No pairs could be evaluated. Inspect status messages above.')
y_true = valid.actual_match.to_numpy(dtype=bool)
y_pred = valid.predicted_match.to_numpy(dtype=bool)
tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[False, True]).ravel()

def percent(numerator, denominator):
    return 100.0 * numerator / denominator if denominator else np.nan

accuracy = percent(results.correct.sum(), len(results))
precision = percent(tp, tp + fp)
recall = percent(tp, tp + fn)
specificity = percent(tn, tn + fp)
f1 = percent(2 * tp, 2 * tp + fp + fn)
balanced = (recall + specificity) / 2 if np.isfinite(recall) and np.isfinite(specificity) else np.nan
auc = 100 * roc_auc_score(y_true, -valid.distance) if np.unique(y_true).size == 2 else np.nan
summary = pd.DataFrame({
    'Metric': ['End-to-end pair accuracy', 'Precision', 'Recall / sensitivity', 'F1 score',
               'Specificity', 'Balanced accuracy', 'ROC-AUC'],
    'Percentage (%)': [accuracy, precision, recall, f1, specificity, balanced, auc],
    'Scope': ['ALL pairs; failures count as incorrect'] + ['Successfully processed pairs only'] * 6,
})
print('\n' + summary.round(2).to_string(index=False, na_rep='Unavailable'))
print(f'\nMODEL PAIR-TEST SUCCESS: {accuracy:.2f}% ({results.correct.sum()}/{len(results)} correct)')
print(f'Processing coverage: {percent(len(valid),len(results)):.2f}% | Failed pairs: {len(results)-len(valid)}')
print(f'TP={tp}, TN={tn}, FP={fp}, FN={fn} (successfully processed pairs)')
print('These are measured test-set results, not a guarantee for all wedding photos.')
print('Small or unrepresentative tests and repeated people can make percentages misleading.')
print('Pair accuracy does not measure full-album Recall@K or mAP. Use separate held-out people/events for paper claims.')

# %% 5. Percentage bar chart
fig, ax = plt.subplots(figsize=(11, 5))
values = summary['Percentage (%)'].to_numpy()
bars = ax.bar(summary.Metric, np.nan_to_num(values), color='#8f503f')
for bar, value in zip(bars, values):
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+1,
            f'{value:.2f}%' if np.isfinite(value) else 'Unavailable', ha='center', fontsize=9)
ax.set(ylim=(0, 112), ylabel='Score (%)', title=f'AlbumIQ face-pair evaluation — {len(results)} labeled pairs')
plt.xticks(rotation=25, ha='right')
plt.tight_layout()
plt.show()

# %% 6. Confusion matrix with counts and percentages
matrix = np.array([[tn, fp], [fn, tp]])
fig, ax = plt.subplots(figsize=(6, 5))
image = ax.imshow(matrix, cmap='Blues')
for i in range(2):
    for j in range(2):
        ax.text(j, i, f'{matrix[i,j]}\n{percent(matrix[i,j],len(valid)):.1f}% of valid pairs',
                ha='center', va='center', color='white' if matrix[i,j] > matrix.max()/2 else 'black')
ax.set(xticks=[0,1], yticks=[0,1], xticklabels=['Different person','Same person'],
       yticklabels=['Different person','Same person'], xlabel='Prediction', ylabel='Human-verified answer',
       title=f'Confusion matrix — {len(valid)} processed pairs; {len(results)-len(valid)} failures excluded')
fig.colorbar(image, ax=ax, label='Pair count')
plt.tight_layout()
plt.show()

# %% 7. ROC curve and real distance distributions
fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
if np.unique(y_true).size == 2:
    fpr, tpr, _ = roc_curve(y_true, -valid.distance)
    axes[0].plot(fpr*100, tpr*100, label=f'ROC-AUC = {auc:.2f}%')
    axes[0].plot([0,100],[0,100],'--',color='gray',label='Chance reference')
    axes[0].legend()
else:
    axes[0].text(.5,.5,'ROC unavailable: both classes need valid pairs',ha='center',transform=axes[0].transAxes)
axes[0].set(xlabel='False positive rate (%)', ylabel='True positive rate (%)', title='ROC — processed pairs')
for match, label in [(True,'Same person'),(False,'Different person')]:
    distances = valid.loc[valid.actual_match == match, 'distance']
    if len(distances): axes[1].hist(distances, bins=min(15,max(3,len(distances))), alpha=.6, label=f'{label} (n={len(distances)})')
axes[1].axvline(THRESHOLD,color='black',linestyle='--',label=f'Production threshold {THRESHOLD:.3f}')
axes[1].set(xlabel='Euclidean distance (lower = more similar)', ylabel='Pair count', title='Genuine vs impostor distances')
axes[1].legend()
plt.tight_layout()
plt.show()
