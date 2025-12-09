import { K8sClient } from './k8s-client';
import { RBACRole, RBACBinding } from './types';

export class RBACManager {
  constructor(private client: K8sClient) {}

  /**
   * Create a Role with specified permissions
   */
  async createRole(role: RBACRole): Promise<void> {
    const rbacApi = this.client.getRbacV1Api();

    try {
      // Check if role exists
      try {
        await rbacApi.readNamespacedRole(role.name, role.namespace);
        console.log(`Role ${role.name} already exists in ${role.namespace}`);
        return;
      } catch (error: any) {
        if (error.response?.statusCode !== 404) {
          throw error;
        }
      }

      // Create the role
      await rbacApi.createNamespacedRole(role.namespace, {
        metadata: {
          name: role.name,
          labels: {
            'app.kubernetes.io/managed-by': 'clustercord'
          }
        },
        rules: role.rules
      });

      console.log(`Created Role: ${role.name} in namespace ${role.namespace}`);
    } catch (error) {
      throw new Error(`Failed to create role: ${error}`);
    }
  }

  /**
   * Create a RoleBinding to bind a Role to a ServiceAccount
   */
  async createRoleBinding(binding: RBACBinding): Promise<void> {
    const rbacApi = this.client.getRbacV1Api();

    try {
      // Check if binding exists
      try {
        await rbacApi.readNamespacedRoleBinding(binding.name, binding.namespace);
        console.log(`RoleBinding ${binding.name} already exists in ${binding.namespace}`);
        return;
      } catch (error: any) {
        if (error.response?.statusCode !== 404) {
          throw error;
        }
      }

      // Create the role binding
      await rbacApi.createNamespacedRoleBinding(binding.namespace, {
        metadata: {
          name: binding.name,
          labels: {
            'app.kubernetes.io/managed-by': 'clustercord'
          }
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: binding.roleName
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: binding.serviceAccountName,
            namespace: binding.namespace
          }
        ]
      });

      console.log(`Created RoleBinding: ${binding.name} in namespace ${binding.namespace}`);
    } catch (error) {
      throw new Error(`Failed to create role binding: ${error}`);
    }
  }

  /**
   * Delete a Role
   */
  async deleteRole(name: string, namespace: string): Promise<void> {
    const rbacApi = this.client.getRbacV1Api();

    try {
      await rbacApi.deleteNamespacedRole(name, namespace);
      console.log(`Deleted Role: ${name} from namespace ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw new Error(`Failed to delete role: ${error}`);
      }
    }
  }

  /**
   * Delete a RoleBinding
   */
  async deleteRoleBinding(name: string, namespace: string): Promise<void> {
    const rbacApi = this.client.getRbacV1Api();

    try {
      await rbacApi.deleteNamespacedRoleBinding(name, namespace);
      console.log(`Deleted RoleBinding: ${name} from namespace ${namespace}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw new Error(`Failed to delete role binding: ${error}`);
      }
    }
  }

  /**
   * Create standard ClusterCord pod-exec role
   */
  async createPodExecRole(namespace: string, roleName = 'clustercord-pod-exec'): Promise<void> {
    await this.createRole({
      name: roleName,
      namespace,
      rules: [
        {
          apiGroups: [''],
          resources: ['pods', 'pods/exec', 'pods/log'],
          verbs: ['get', 'list', 'watch', 'create']
        }
      ]
    });
  }

  /**
   * Setup complete RBAC for a user (ServiceAccount + Role + RoleBinding)
   */
  async setupUserRBAC(
    discordId: string,
    namespace: string,
    roleName = 'clustercord-pod-exec'
  ): Promise<string> {
    const serviceAccountName = `clustercord-user-${discordId}`;
    const bindingName = `clustercord-binding-${discordId}`;

    // Ensure the pod-exec role exists
    await this.createPodExecRole(namespace, roleName);

    // Create the role binding
    await this.createRoleBinding({
      name: bindingName,
      namespace,
      roleName,
      serviceAccountName
    });

    return serviceAccountName;
  }

  /**
   * Remove all RBAC for a user
   */
  async removeUserRBAC(discordId: string, namespace: string): Promise<void> {
    const bindingName = `clustercord-binding-${discordId}`;

    await this.deleteRoleBinding(bindingName, namespace);
  }

  /**
   * Generate RBAC YAML templates
   */
  generateRBACYAML(discordId: string, namespace: string): string {
    const serviceAccountName = `clustercord-user-${discordId}`;
    const roleName = 'clustercord-pod-exec';
    const bindingName = `clustercord-binding-${discordId}`;

    return `---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${serviceAccountName}
  namespace: ${namespace}
  labels:
    app.kubernetes.io/managed-by: clustercord
    clustercord.io/service-account: user
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${roleName}
  namespace: ${namespace}
  labels:
    app.kubernetes.io/managed-by: clustercord
rules:
- apiGroups: [""]
  resources: ["pods", "pods/exec", "pods/log"]
  verbs: ["get", "list", "watch", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${bindingName}
  namespace: ${namespace}
  labels:
    app.kubernetes.io/managed-by: clustercord
subjects:
- kind: ServiceAccount
  name: ${serviceAccountName}
  namespace: ${namespace}
roleRef:
  kind: Role
  name: ${roleName}
  apiGroup: rbac.authorization.k8s.io
`;
  }
}
