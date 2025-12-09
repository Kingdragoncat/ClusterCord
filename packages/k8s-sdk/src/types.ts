export interface ClusterConfig {
  kubeconfig: string;
  context?: string;
}

export interface ServiceAccountConfig {
  name: string;
  namespace: string;
}

export interface TokenRequestConfig {
  serviceAccount: string;
  namespace: string;
  audiences?: string[];
  expirationSeconds?: number;
}

export interface TokenResponse {
  token: string;
  expiresAt: Date;
}

export interface ExecOptions {
  podName: string;
  namespace: string;
  containerName?: string;
  command?: string[];
  shell?: string;
  tty?: boolean;
}

export interface RBACRole {
  name: string;
  namespace: string;
  rules: RBACRule[];
}

export interface RBACRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface RBACBinding {
  name: string;
  namespace: string;
  roleName: string;
  serviceAccountName: string;
}
