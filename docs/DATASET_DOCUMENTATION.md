# Dataset documentation
| Item | Value |
|---|---|
| Name | Crop Recommendation Dataset (Atharva Ingle) |
| Original source | https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset |
| File actually used | Copy from GitHub mirror `Gladiator07/Harvestify/Data-processed/crop_recommendation.csv`, downloaded November 2026 (Kaggle was not reachable from the build environment) |
| Shape | 2200 rows x 8 columns, 22 crops, exactly 100 rows per crop |
| Missing / duplicates | 0 / 0 |
| Licence | **Verify on the Kaggle page and record it here.** Not confirmed by me. |

**To use the original Kaggle file:** download it, replace `backend/datasets/crop_recommendation.csv`, run `python -m ml.train`. Compare shape (2200x8).

## Caveats you must state in your report/viva
- The dataset is balanced and class-separable; the author describes it as built from rainfall, climate and fertiliser data for India. Treat it as a curated/derived dataset, not field-measured soil tests.
- N, P, K units are not documented, so they are NOT comparable with lab kg/ha. The app handles this with an explicit unit selector.
- No location column, so SoilGrids / NASA POWER / FAOSTAT cannot be joined row-by-row. These are listed as future work rather than merged blindly.
- Checks done in `ml/preprocessing.integrity_report`: missing, duplicates, class balance, IQR outliers, ranges.
