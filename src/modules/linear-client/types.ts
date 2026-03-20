export interface Issue {
  id: string;
  identifier: string; // e.g. "SYM-12"
  title: string;
  description: string;
  state: string;
  labels: string[];
  blockers: { identifier: string; state: string }[];
}

export interface RawLinearLabel {
  name: string;
}

export interface RawLinearState {
  name: string;
}

export interface RawLinearRelation {
  relatedIssue: {
    identifier: string;
    state: RawLinearState;
  };
}

export interface RawLinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: RawLinearState;
  labels: {
    nodes: RawLinearLabel[];
  };
  relations: {
    nodes: RawLinearRelation[];
  };
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}
