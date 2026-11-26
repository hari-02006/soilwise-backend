export type NpkUnit = "dataset_scale" | "kg_per_ha";
export interface CropScore { crop: string; probability: number }
export interface ShapItem { feature: string; value: number; shap: number }
export interface ParamStatus { status: string; value: number | null; rating?: string; class?: string; basis?: string }
export interface SoilHealth {
  parameters: Record<string, ParamStatus>;
  ph_interpretation: { class: string; advice: string } | null;
  findings: string[];
  potential_deficiencies: { nutrient: string; advice: string }[];
  missing_parameters: string[];
  general_improvements: string[];
  disclaimer: string;
}
export interface ClusterInfo {
  cluster_id: number; point: [number, number];
  background: { x: number; y: number; cluster: number }[]; explained_variance_2d: number;
}
export interface CropRec {
  top_crops: CropScore[]; model: string; model_version: string; model_test_accuracy?: number;
  warnings: string[]; probability_note: string;
  explanations?: { crop: string; contributions: ShapItem[]; note: string }[];
  explanation_text?: string; cluster?: ClusterInfo;
}
export interface Analysis {
  analysis_id?: string; created_at?: string; location?: string | null; saved: boolean; save_error?: string;
  soil_parameters: Record<string, number | null>; npk_unit: NpkUnit; input_source: string;
  soil_health: SoilHealth; crop_recommendations: CropRec | null; crop_recommendation_skipped?: string;
  model_version?: string | null;
}
export interface ExtractedValue { value: number | null; unit: string | null; found: boolean; plausible?: boolean; snippet?: string }
export interface UploadResult {
  method: string; extracted: Record<string, ExtractedValue>; found_parameters: string[];
  detected_npk_unit: "kg_per_ha" | "unknown"; raw_text_preview: string; warning: string;
}
export interface ModelResult {
  cv_accuracy_mean: number; cv_accuracy_std: number; cv_f1_macro_mean: number;
  test: { accuracy: number; precision_macro: number; recall_macro: number; f1_macro: number; confusion_matrix: number[][]; labels: string[] };
}
export interface Metrics {
  selected_model: string; model_version: string; trained_at: string; models: Record<string, ModelResult>;
  feature_importance: Record<string, number>;
  dataset_integrity: { rows: number; missing_values: number; duplicate_rows: number; n_classes: number;
    samples_per_class_min_max: number[]; iqr_outlier_counts: Record<string, number>; feature_ranges: Record<string, number[]> };
  kmeans: { silhouette_by_k: Record<string, number>; chosen_k: number;
    cluster_profiles: Record<string, Record<string, number>>; top_crops_per_cluster: Record<string, Record<string, number>> };
}
export interface Stats {
  total_analyses: number; top_recommended_crops: { crop: string; count: number }[];
  ph_class_distribution: Record<string, number>;
  recent: { analysis_id: string; created_at: string; location: string | null; top_crop: string | null }[];
}
export interface Health { status: string; model: { loaded: boolean; name?: string; version?: string; reason?: string }; database: boolean }
