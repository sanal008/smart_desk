export type Role = "CUSTOMER" | "AGENT" | "TEAM_LEAD" | "ADMIN";
export type TicketStatus =
  | "NEW"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "WAITING_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Sentiment = "positive" | "neutral" | "negative" | "";

export interface Team {
  id: number;
  name: string;
  slug: string;
  description: string;
  expertise: string[];
  member_count: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  role_display?: string;
  team: number | null;
  team_name?: string | null;
  tier: "free" | "standard" | "enterprise";
  title: string;
  skills: string[];
  avatar_url: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  default_team: number | null;
  default_team_name?: string | null;
  icon: string;
  open_ticket_count: number;
}

export interface AiSummary {
  text: string;
  confidence: number;
  model_version?: string;
}

export interface TicketListItem {
  id: string;
  number: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  is_priority_ai_suggested: boolean;
  category: number | null;
  category_name: string | null;
  category_slug: string | null;
  team: number | null;
  team_name: string | null;
  requester: number;
  requester_username: string;
  assignee: number | null;
  assignee_username: string | null;
  sentiment: Sentiment;
  due_at: string | null;
  first_response_due_at: string | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
  is_sla_breached: boolean;
  is_first_response_breached: boolean;
  ai_summary: AiSummary | null;
}

export interface Comment {
  id: number;
  ticket: string;
  author: number;
  author_username: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  is_ai_draft: boolean;
  created_at: string;
}

export interface Attachment {
  id: number;
  file: string;
  url: string | null;
  original_name: string;
  size: number;
  uploaded_by_username: string;
  created_at: string;
}

export interface Activity {
  id: number;
  actor: number | null;
  actor_username: string | null;
  is_ai_actor: boolean;
  action: string;
  field: string;
  old_value: string;
  new_value: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FeatureContribution {
  feature: string;
  weight: number;
}

export interface MLPrediction {
  id: number;
  ticket: string;
  task: string;
  task_display: string;
  predicted_label: string;
  confidence: number;
  explanation: {
    top_features?: FeatureContribution[];
    probabilities?: Record<string, number>;
    customer_tier?: string;
    compound?: number;
    method?: string;
    user_id?: number;
    reasoning?: string;
    shortlist?: { id: number; username: string; score: number; open_tickets: number }[];
    retrieved_case?: SimilarCase | null;
    tone?: string;
    [key: string]: unknown;
  };
  model_version: string;
  created_at: string;
}

export interface SimilarCase {
  category: string;
  subject: string;
  resolution_note: string;
  similarity: number;
}

export interface TicketDetail extends TicketListItem {
  description: string;
  requester_detail: User;
  assignee_detail: User | null;
  team_detail: Team | null;
  comments: Comment[];
  attachments: Attachment[];
  activities: Activity[];
  predictions: MLPrediction[];
  first_response_at: string | null;
  resolved_at: string | null;
  sla: {
    due_at: string | null;
    first_response_due_at: string | null;
    is_breached: boolean;
    is_first_response_breached: boolean;
  };
}

export interface PagedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface OverviewAnalytics {
  totals: {
    all: number;
    open: number;
    unassigned: number;
    created_this_week: number;
    resolved_this_week: number;
    sla_breached: number;
    sla_at_risk: number;
  };
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_sentiment: Record<string, number>;
  sla: {
    breached: number;
    at_risk: number;
    on_track: number;
    avg_first_response_minutes: number | null;
    avg_resolution_hours: number | null;
  };
}

export interface VolumePoint {
  date: string;
  created: number;
  resolved: number;
}

export interface AgentWorkload {
  id: number;
  username: string;
  full_name: string;
  team: string | null;
  open_assigned: number;
  resolved_total: number;
  urgent_open: number;
  avg_first_response_minutes: number | null;
}

export interface CategoryTrendPoint {
  date: string;
  count: number;
}

export interface DraftPrediction {
  category: MLPredictionOutput;
  priority: MLPredictionOutput;
  sentiment: MLPredictionOutput;
  team: MLPredictionOutput;
  summary: MLPredictionOutput;
  model_version: string;
}

export interface MLPredictionOutput {
  label: string;
  confidence: number;
  probabilities?: Record<string, number>;
  explanation: Record<string, unknown> & {
    top_features?: FeatureContribution[];
  };
  model_version: string;
}

export interface ModelMetricsPayload {
  is_ready: boolean;
  active_version: string | null;
  static_metrics: {
    version?: string;
    trained_at?: string;
    category?: MetricsBlock;
    priority?: MetricsBlock;
    routing?: MetricsBlock;
    [key: string]: unknown;
  };
  human_feedback: {
    total: number;
    accepted: number;
    corrected: number;
    acceptance_rate: number | null;
    per_task: {
      task: string;
      feedback_count: number;
      accepted: number;
      corrections: number;
      acceptance_rate: number | null;
    }[];
    most_common_corrections: [string, number][];
  };
  recent_runs: {
    version: string;
    trained_at: string;
    train_size: number;
    test_size: number;
    metrics: Record<string, unknown>;
  }[];
}

export interface MetricsBlock {
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  weighted_f1: number;
  support: number;
  labels: string[];
  confusion_matrix: number[][];
}
