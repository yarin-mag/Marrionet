export interface TokenAlert {
  id: string;
  agentId: string;
  threshold: number;
  fired: boolean;
  createdAt: string;
}
