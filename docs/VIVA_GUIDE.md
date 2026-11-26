# Viva guide (answers reflect this project's real results)
1. **Why Random Forest?** It scored highest in repeated stratified training CV macro-F1 (0.9932 versus XGBoost 0.9900 and Decision Tree 0.9840). Nested grid search then tuned its parameters. The selected model achieved 99.55% accuracy on the same held-out benchmark split used in the original project.
2. **Why are scores so high?** The curated dataset is balanced and nearly separable. The preprocessing fits on training folds, and an independent field dataset is needed to measure geographic and seasonal generalization.
3. **What does the probability mean?** Random Forest averages tree votes. It is the model's score, not crop-success likelihood. Often 100% here because of separable data.
4. **How does Random Forest work?** Many decision trees on bootstrap samples with random feature subsets; majority/average vote reduces variance.
5. **Why stratified split and CV?** Keeps class proportions; CV gives a variance estimate (std in metrics).
6. **What is SHAP?** Shapley values from game theory: each feature's average marginal contribution to the model output; TreeExplainer computes them exactly for trees. Describes the model, not causation.
7. **K-Means and choosing k?** Minimises within-cluster variance; k picked by silhouette score on standardised features. Scaling matters because features have different units.
8. **Why not trust OCR directly?** Digit misreads; so values are editable and the user must confirm.
9. **How is OCR done?** PyMuPDF text for digital PDFs; otherwise render pages / preprocess image (grayscale, upscale, denoise, adaptive threshold) -> Tesseract -> regex with plausibility ranges.
10. **Soil screening validity?** Rule-based. kg/ha uses ICAR-style general classes; dataset-scale values are only relative terciles. Not a validated diagnosis.
11. **Why unit selector?** Dataset NPK units undocumented, lab values are kg/ha; mixing would mislead.
12. **Why 503 instead of defaults?** Never fabricate predictions or data.
13. **Security measures?** Pydantic ranges, size limit, extension + magic-byte checks, env-based secrets, CORS allow-list, in-memory file handling.
14. **Limitations?** See PROJECT_LOG.md (no auth, Atlas/real-report/visual testing pending, no external data enrichment).
