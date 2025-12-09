import { PrismaClient } from '@prisma/client';

export interface ApprovalRequest {
  id: string;
  userId: string;
  command: string;
  args: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  expiresAt: Date;
  createdAt: Date;
}

export interface ApprovalConfig {
  requireApproval: boolean;
  timeout: number; // seconds
  notifyOwner: boolean;
}

export class ApprovalFlowService {
  private prisma: PrismaClient;
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();

  // Commands that require approval
  private dangerousCommands = new Set([
    'cluster.remove',
    'pod.delete',
    'deployment.delete',
    'namespace.delete',
    'apply.manifest',
    'exec.command',
    'chaos.start'
  ]);

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.startCleanupInterval();
  }

  /**
   * Check if command requires approval
   */
  requiresApproval(command: string, args: Record<string, any>): boolean {
    // Check if command is in dangerous list
    if (this.dangerousCommands.has(command)) {
      return true;
    }

    // Check for destructive keywords in args
    const destructiveKeywords = ['delete', 'remove', 'destroy', 'force'];
    const argsString = JSON.stringify(args).toLowerCase();

    for (const keyword of destructiveKeywords) {
      if (argsString.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(
    userId: string,
    command: string,
    args: Record<string, any>,
    config: ApprovalConfig = {
      requireApproval: true,
      timeout: 300, // 5 minutes default
      notifyOwner: true
    }
  ): Promise<ApprovalRequest> {
    const severity = this.calculateSeverity(command, args);

    const request: ApprovalRequest = {
      id: this.generateId(),
      userId,
      command,
      args,
      severity,
      expiresAt: new Date(Date.now() + config.timeout * 1000),
      createdAt: new Date()
    };

    this.pendingApprovals.set(request.id, request);

    // Store in database
    await this.prisma.approvalRequest.create({
      data: {
        id: request.id,
        userId,
        command,
        args: args as any,
        severity,
        expiresAt: request.expiresAt,
        status: 'PENDING'
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'APPROVAL_REQUESTED',
        metadata: {
          approvalId: request.id,
          command,
          severity
        }
      }
    });

    return request;
  }

  /**
   * Approve request
   */
  async approve(requestId: string, approverId: string): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId);

    if (!request) {
      throw new Error('Approval request not found or expired');
    }

    if (new Date() > request.expiresAt) {
      this.pendingApprovals.delete(requestId);
      throw new Error('Approval request expired');
    }

    // Update database
    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date()
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: approverId,
        action: 'APPROVAL_GRANTED',
        metadata: {
          approvalId: requestId,
          requestedBy: request.userId
        }
      }
    });

    this.pendingApprovals.delete(requestId);
    return true;
  }

  /**
   * Reject request
   */
  async reject(requestId: string, rejectorId: string, reason?: string): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId);

    if (!request) {
      throw new Error('Approval request not found');
    }

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy: rejectorId,
        rejectedAt: new Date(),
        rejectionReason: reason
      }
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: rejectorId,
        action: 'APPROVAL_REJECTED',
        metadata: {
          approvalId: requestId,
          requestedBy: request.userId,
          reason
        }
      }
    });

    this.pendingApprovals.delete(requestId);
    return true;
  }

  /**
   * Cancel request (by requester)
   */
  async cancel(requestId: string, userId: string): Promise<boolean> {
    const request = this.pendingApprovals.get(requestId);

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.userId !== userId) {
      throw new Error('Only requester can cancel approval request');
    }

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    this.pendingApprovals.delete(requestId);
    return true;
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.pendingApprovals.values()).filter(
      (req) => req.userId === userId && new Date() < req.expiresAt
    );
  }

  /**
   * Check if request is approved
   */
  async isApproved(requestId: string): Promise<boolean> {
    const record = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId }
    });

    return record?.status === 'APPROVED';
  }

  /**
   * Calculate severity based on command and args
   */
  private calculateSeverity(
    command: string,
    args: Record<string, any>
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: deletion, force operations
    if (
      command.includes('delete') ||
      command.includes('remove') ||
      args.force === true
    ) {
      return 'critical';
    }

    // High: modifications, chaos engineering
    if (
      command.includes('apply') ||
      command.includes('patch') ||
      command.includes('chaos')
    ) {
      return 'high';
    }

    // Medium: exec, terminal
    if (command.includes('exec') || command.includes('terminal')) {
      return 'medium';
    }

    // Low: everything else
    return 'low';
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup expired approvals
   */
  private startCleanupInterval() {
    setInterval(() => {
      const now = new Date();

      for (const [id, request] of this.pendingApprovals) {
        if (now > request.expiresAt) {
          this.pendingApprovals.delete(id);

          // Update database
          this.prisma.approvalRequest
            .update({
              where: { id },
              data: {
                status: 'EXPIRED',
                expiredAt: now
              }
            })
            .catch((err) => console.error('Failed to update expired approval:', err));
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Get approval statistics
   */
  async getStats(userId?: string) {
    const where = userId ? { userId } : {};

    const [total, approved, rejected, expired, pending] = await Promise.all([
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.approvalRequest.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.approvalRequest.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.approvalRequest.count({ where: { ...where, status: 'PENDING' } })
    ]);

    return {
      total,
      approved,
      rejected,
      expired,
      pending,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : '0'
    };
  }
}
