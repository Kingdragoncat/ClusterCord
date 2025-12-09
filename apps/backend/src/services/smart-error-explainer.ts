/**
 * Smart Error Explainer - Translates cryptic K8s errors into human-readable explanations
 */

export interface ErrorExplanation {
  originalError: string;
  explanation: string;
  possibleCauses: string[];
  recommendedFixes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'network' | 'resource' | 'config' | 'permission' | 'other';
  relatedDocs: string[];
}

export class SmartErrorExplainer {
  private errorPatterns: Map<RegExp, ErrorExplanation> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Explain a Kubernetes error in human terms
   */
  explain(error: string): ErrorExplanation {
    // Try to match against known patterns
    for (const [pattern, explanation] of this.errorPatterns) {
      if (pattern.test(error)) {
        return {
          ...explanation,
          originalError: error
        };
      }
    }

    // Default explanation for unknown errors
    return {
      originalError: error,
      explanation: 'An unexpected error occurred with your Kubernetes cluster.',
      possibleCauses: ['Unknown error pattern'],
      recommendedFixes: ['Check cluster logs', 'Verify cluster connectivity'],
      severity: 'medium',
      category: 'other',
      relatedDocs: ['https://kubernetes.io/docs/tasks/debug/']
    };
  }

  /**
   * Initialize common error patterns
   */
  private initializePatterns() {
    // Forbidden / RBAC errors
    this.errorPatterns.set(
      /forbidden|is forbidden|User .* cannot/i,
      {
        originalError: '',
        explanation: '🔒 Permission Denied - Your ServiceAccount lacks the required RBAC permissions.',
        possibleCauses: [
          'ServiceAccount does not have a Role or ClusterRole binding',
          'The Role lacks specific verbs (get, list, create, etc.)',
          'You are trying to access a cluster-wide resource with a namespaced Role',
          'RBAC is enabled but permissions were not configured'
        ],
        recommendedFixes: [
          'Create a RoleBinding: kubectl create rolebinding <name> --role=<role> --serviceaccount=<namespace>:<sa>',
          'Grant cluster-admin (NOT recommended for production): kubectl create clusterrolebinding <name> --clusterrole=cluster-admin --serviceaccount=<namespace>:<sa>',
          'Use /rbac visualize to see current permissions',
          'Check existing roles: kubectl get roles,rolebindings -n <namespace>'
        ],
        severity: 'high',
        category: 'permission',
        relatedDocs: [
          'https://kubernetes.io/docs/reference/access-authn-authz/rbac/',
          'https://kubernetes.io/docs/reference/access-authn-authz/authorization/'
        ]
      }
    );

    // Connection refused
    this.errorPatterns.set(
      /connection refused|ECONNREFUSED/i,
      {
        originalError: '',
        explanation: '🔌 Connection Refused - Cannot reach the Kubernetes API server.',
        possibleCauses: [
          'Kubeconfig has wrong server endpoint',
          'Cluster is down or unreachable',
          'Firewall blocking connection',
          'VPN required but not connected',
          'API server certificate issues'
        ],
        recommendedFixes: [
          'Test connectivity: curl -k https://<api-server>:6443',
          'Verify kubeconfig context: kubectl config current-context',
          'Check cluster status: kubectl cluster-info',
          'Ensure VPN is connected if required',
          'Verify API server is running: systemctl status kube-apiserver'
        ],
        severity: 'critical',
        category: 'network',
        relatedDocs: [
          'https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/'
        ]
      }
    );

    // ImagePullBackOff
    this.errorPatterns.set(
      /ImagePullBackOff|ErrImagePull|Failed to pull image/i,
      {
        originalError: '',
        explanation: '📦 Image Pull Failed - Kubernetes cannot download the container image.',
        possibleCauses: [
          'Image does not exist in the registry',
          'Image tag is wrong or typo in image name',
          'Private registry requires authentication (imagePullSecret)',
          'Network connectivity issues to registry',
          'Registry is rate-limiting requests (Docker Hub)'
        ],
        recommendedFixes: [
          'Verify image exists: docker pull <image>',
          'Check image name and tag for typos',
          'Create imagePullSecret: kubectl create secret docker-registry <name> --docker-server=<server> --docker-username=<user> --docker-password=<pass>',
          'Add imagePullSecrets to pod spec',
          'Use different registry or mirror'
        ],
        severity: 'high',
        category: 'config',
        relatedDocs: [
          'https://kubernetes.io/docs/concepts/containers/images/',
          'https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/'
        ]
      }
    );

    // CrashLoopBackOff
    this.errorPatterns.set(
      /CrashLoopBackOff/i,
      {
        originalError: '',
        explanation: '🔄 Crash Loop - Container starts but immediately crashes repeatedly.',
        possibleCauses: [
          'Application error on startup (bad code, missing dependency)',
          'Missing environment variables or config',
          'Wrong command or entrypoint',
          'Liveness probe failing',
          'Insufficient resources (OOMKilled)',
          'Missing volume mounts or files'
        ],
        recommendedFixes: [
          'Check container logs: kubectl logs <pod> --previous',
          'Describe pod for events: kubectl describe pod <pod>',
          'Verify environment variables are set',
          'Test container locally: docker run <image>',
          'Increase memory/CPU limits',
          'Check liveness/readiness probe configuration'
        ],
        severity: 'high',
        category: 'resource',
        relatedDocs: [
          'https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/',
          'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/'
        ]
      }
    );

    // OOMKilled
    this.errorPatterns.set(
      /OOMKilled|out of memory/i,
      {
        originalError: '',
        explanation: '💾 Out of Memory - Container exceeded its memory limit and was killed.',
        possibleCauses: [
          'Memory limit is too low for the application',
          'Application has a memory leak',
          'Large dataset being processed',
          'No memory limit set (using node memory)',
          'JVM heap size misconfigured'
        ],
        recommendedFixes: [
          'Increase memory limit in pod spec: resources.limits.memory',
          'Monitor actual usage: kubectl top pod <pod>',
          'Profile application for memory leaks',
          'Set appropriate JVM heap: -Xmx flag',
          'Add memory requests to ensure scheduling: resources.requests.memory',
          'Use horizontal pod autoscaling for traffic spikes'
        ],
        severity: 'high',
        category: 'resource',
        relatedDocs: [
          'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
          'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/'
        ]
      }
    );

    // Unauthorized
    this.errorPatterns.set(
      /Unauthorized|401|authentication required/i,
      {
        originalError: '',
        explanation: '🔑 Authentication Failed - Invalid or missing credentials.',
        possibleCauses: [
          'Kubeconfig token expired',
          'ServiceAccount token invalid',
          'Certificate authentication failed',
          'OIDC token expired',
          'Context not set correctly'
        ],
        recommendedFixes: [
          'Refresh kubeconfig: kubectl config view',
          'Get new token: kubectl create token <service-account>',
          'Verify current context: kubectl config current-context',
          'Check certificate expiry: openssl x509 -in <cert> -text -noout',
          'Re-authenticate with cloud provider: az aks get-credentials / gcloud container clusters get-credentials'
        ],
        severity: 'critical',
        category: 'auth',
        relatedDocs: [
          'https://kubernetes.io/docs/reference/access-authn-authz/authentication/'
        ]
      }
    );

    // PodSecurityPolicy
    this.errorPatterns.set(
      /PodSecurityPolicy|PSP|pod security/i,
      {
        originalError: '',
        explanation: '🛡️ Pod Security Policy Violation - Pod spec violates security constraints.',
        possibleCauses: [
          'Trying to run as root user',
          'Using privileged mode',
          'Requesting dangerous capabilities',
          'Mounting host paths',
          'Using hostNetwork or hostPID'
        ],
        recommendedFixes: [
          'Run as non-root: set securityContext.runAsNonRoot: true',
          'Remove privileged: false',
          'Use minimal capabilities or drop ALL',
          'Avoid hostPath volumes',
          'Review Pod Security Standards: https://kubernetes.io/docs/concepts/security/pod-security-standards/'
        ],
        severity: 'high',
        category: 'permission',
        relatedDocs: [
          'https://kubernetes.io/docs/concepts/security/pod-security-standards/',
          'https://kubernetes.io/docs/concepts/security/pod-security-policy/'
        ]
      }
    );

    // Missing CRD
    this.errorPatterns.set(
      /no matches for kind|the server doesn't have a resource type/i,
      {
        originalError: '',
        explanation: '❓ Custom Resource Not Found - The CRD is not installed in your cluster.',
        possibleCauses: [
          'Custom Resource Definition (CRD) not installed',
          'Wrong API version',
          'Operator not deployed',
          'CRD was deleted'
        ],
        recommendedFixes: [
          'List installed CRDs: kubectl get crds',
          'Install the CRD: kubectl apply -f <crd.yaml>',
          'Install the operator: helm install <chart>',
          'Verify API version matches: kubectl api-resources | grep <kind>'
        ],
        severity: 'medium',
        category: 'config',
        relatedDocs: [
          'https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/'
        ]
      }
    );

    // Node NotReady
    this.errorPatterns.set(
      /node.*not ready|NodeNotReady/i,
      {
        originalError: '',
        explanation: '🖥️ Node Not Ready - A cluster node is unhealthy or unreachable.',
        possibleCauses: [
          'Node out of resources (disk, memory, CPU)',
          'kubelet crashed or stopped',
          'Network connectivity issues',
          'Disk pressure',
          'Node was cordoned or drained'
        ],
        recommendedFixes: [
          'Check node status: kubectl get nodes',
          'Describe node: kubectl describe node <node>',
          'Check kubelet logs: journalctl -u kubelet',
          'Free up disk space if needed',
          'Uncordon node if drained: kubectl uncordon <node>',
          'Check node conditions for specific issues'
        ],
        severity: 'critical',
        category: 'resource',
        relatedDocs: [
          'https://kubernetes.io/docs/tasks/debug/debug-cluster/monitor-node-health/'
        ]
      }
    );

    // Timeout
    this.errorPatterns.set(
      /timeout|timed out|context deadline exceeded/i,
      {
        originalError: '',
        explanation: '⏱️ Request Timeout - Operation took too long to complete.',
        possibleCauses: [
          'API server under heavy load',
          'Network latency too high',
          'Large resource query (too many pods)',
          'etcd performance issues',
          'Control plane overloaded'
        ],
        recommendedFixes: [
          'Increase timeout in kubeconfig',
          'Use pagination for large lists: --chunk-size=500',
          'Filter queries: kubectl get pods --field-selector=status.phase=Running',
          'Check API server load: kubectl top nodes',
          'Scale up control plane if needed'
        ],
        severity: 'medium',
        category: 'network',
        relatedDocs: [
          'https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/'
        ]
      }
    );
  }

  /**
   * Get all error patterns for documentation
   */
  getKnownPatterns(): Array<{ pattern: string; category: string; severity: string }> {
    const patterns: Array<{ pattern: string; category: string; severity: string }> = [];

    for (const [regex, explanation] of this.errorPatterns) {
      patterns.push({
        pattern: regex.source,
        category: explanation.category,
        severity: explanation.severity
      });
    }

    return patterns;
  }

  /**
   * Filter sensitive information from error messages
   */
  sanitizeError(error: string): string {
    // Remove tokens
    error = error.replace(/token[:=]\s*([a-zA-Z0-9-._]+)/gi, 'token: [REDACTED]');

    // Remove passwords
    error = error.replace(/password[:=]\s*([^\s]+)/gi, 'password: [REDACTED]');

    // Remove API keys
    error = error.replace(/api[-_]?key[:=]\s*([^\s]+)/gi, 'api-key: [REDACTED]');

    // Remove IP addresses (optional, can be too aggressive)
    // error = error.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');

    return error;
  }
}
