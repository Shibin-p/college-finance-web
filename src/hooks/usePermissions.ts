import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useEvent } from "./useEvent";
import { subscribeToUserAssignments } from "../services/coordinatorService";
import type {
  CoordinatorAssignmentModel,
  CoordinatorPermissions,
  ViewerPermissions,
  ViewerScope,
  CrossClassCapabilities,
} from "../types";

const defaultPermissions: CoordinatorPermissions = {
  canView: false,
  canViewStudents: false,
  canAddPayment: false,
  canAddInstallment: false,
  canEditPayment: false,
  canViewReports: false,
};

const defaultViewerPermissions: ViewerPermissions = {
  canViewAggregate: true,
  canViewStudentCollectionStatus: false,
  canViewExpenses: false,
  canViewExpenseCategories: false,
};

const defaultCrossClassCapabilities: CrossClassCapabilities = {
  canViewCollection: false,
  canAddPayment: false,
  canAddInstallment: false,
  canHandlePendingApprovals: false,
};

export function usePermissions(classId?: string) {
  const { userProfile } = useAuth();
  const { activeEvent } = useEvent();
  const [assignments, setAssignments] = useState<CoordinatorAssignmentModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    if (userProfile.role === "super_coordinator") {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserAssignments(
      userProfile.uid,
      (list) => {
        setAssignments(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to permissions:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userProfile?.uid]);

  if (!userProfile) {
    return {
      isSuper: false,
      isClassCoordinator: false,
      isViewCoordinator: false,
      isCrossClassAssistant: false,
      permissions: defaultPermissions,
      viewerScope: "whole_event" as ViewerScope,
      viewerPermissions: defaultViewerPermissions,
      crossClassCapabilities: defaultCrossClassCapabilities,
      crossClassAuthorizedClassIds: [] as string[],
      assignedClassIds: [] as string[],
      hasAccessToClass: false,
      loading: false,
    };
  }

  const isSuper = userProfile.role === "super_coordinator";
  const isViewCoordinator = userProfile.role === "view_coordinator";
  const isClassCoordinator = userProfile.role === "class_coordinator";

  if (isSuper) {
    return {
      isSuper: true,
      isClassCoordinator: false,
      isViewCoordinator: false,
      isCrossClassAssistant: true,
      permissions: {
        canView: true,
        canViewStudents: true,
        canAddPayment: true,
        canAddInstallment: true,
        canEditPayment: true,
        canViewReports: true,
      },
      viewerScope: "whole_event" as ViewerScope,
      viewerPermissions: {
        canViewAggregate: true,
        canViewStudentCollectionStatus: true,
        canViewExpenses: true,
        canViewExpenseCategories: true,
      },
      crossClassCapabilities: {
        canViewCollection: true,
        canAddPayment: true,
        canAddInstallment: true,
        canHandlePendingApprovals: true,
      },
      crossClassAuthorizedClassIds: [] as string[],
      assignedClassIds: [] as string[],
      hasAccessToClass: true,
      loading: false,
    };
  }

  // Filter active assignments for the current active event
  const currentEventAssignments = assignments.filter(
    (a) => a.active && (!activeEvent || a.eventId === activeEvent.id)
  );

  // Normal Class Coordinator assignments
  const classAssignments = currentEventAssignments.filter(
    (a) => !a.assignmentType || a.assignmentType === "class_coordinator"
  );
  const assignedClassIds = classAssignments.map((a) => a.classId || "").filter(Boolean);

  const matchedAssignment = classId
    ? classAssignments.find((a) => a.classId === classId)
    : classAssignments[0];

  const permissions = matchedAssignment ? matchedAssignment.permissions : defaultPermissions;

  // View Coordinator assignment
  const viewAssignment = currentEventAssignments.find(
    (a) => a.assignmentType === "view_coordinator"
  ) || currentEventAssignments[0];

  const viewerScope: ViewerScope = viewAssignment?.viewerScope || "whole_event";
  const viewerPermissions: ViewerPermissions = {
    ...defaultViewerPermissions,
    ...(viewAssignment?.viewerPermissions || {}),
  };

  // Cross-Class Collection Assistant assignment
  const crossClassAssignment = currentEventAssignments.find(
    (a) => a.crossClassCollection?.enabled || a.assignmentType === "cross_class_assistant"
  );

  const isCrossClassAssistant = Boolean(crossClassAssignment?.crossClassCollection?.enabled);
  const crossClassCapabilities: CrossClassCapabilities =
    crossClassAssignment?.crossClassCollection?.capabilities || defaultCrossClassCapabilities;
  const crossClassAuthorizedClassIds: string[] =
    crossClassAssignment?.crossClassCollection?.authorizedClassIds || [];

  // Check access to a given classId
  let hasAccessToClass = false;
  if (classId) {
    if (assignedClassIds.includes(classId)) {
      hasAccessToClass = true;
    } else if (isCrossClassAssistant && crossClassAuthorizedClassIds.includes(classId)) {
      hasAccessToClass = true;
    } else if (isViewCoordinator) {
      if (viewerScope === "whole_event" || viewAssignment?.classId === classId) {
        hasAccessToClass = true;
      }
    }
  } else {
    hasAccessToClass =
      assignedClassIds.length > 0 ||
      (isCrossClassAssistant && crossClassAuthorizedClassIds.length > 0) ||
      isViewCoordinator;
  }

  return {
    isSuper: false,
    isClassCoordinator,
    isViewCoordinator,
    isCrossClassAssistant,
    permissions,
    viewerScope,
    viewerPermissions,
    crossClassCapabilities,
    crossClassAuthorizedClassIds,
    assignedClassIds,
    hasAccessToClass,
    loading,
  };
}
