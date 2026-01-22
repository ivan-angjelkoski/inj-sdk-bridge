export type StepStatus = "idle" | "pending" | "success" | "error";

export type StepDetail = {
  label: string;
  value: string;
  href?: string;
};

export type BridgeStep = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: StepDetail;
};
