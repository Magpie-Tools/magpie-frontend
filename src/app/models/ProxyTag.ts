export interface ProxyTag {
  id: number;
  name: string;
  color: string;
}

export interface ProxyTagWriteRequest {
  name: string;
  color: string;
}

export interface ProxyTagAssignmentResponse {
  tags: ProxyTag[];
}
