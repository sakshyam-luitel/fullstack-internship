import { gql } from "@apollo/client";

export const LOGIN = gql`
  mutation Login($userInput: UserLoginInput!) {
    login(userInput: $userInput) {
      accessToken
      tokenType
      role
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($adminInput: UserInput!) {
    createUser(adminInput: $adminInput) {
      id
      departmentId
      name
      email
      password
      role
      createdAt
      degreeProgramId
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($adminInput: UserUpdateInput!) {
    updateUser(adminInput: $adminInput) {
      id
      departmentId
      name
      email
      password
      role
      createdAt
      degreeProgramId
    }
  }
`;

export const CREATE_STUDENT_PROFILE = gql`
  mutation CreateStudentProfile($adminInput: StudentProfilesInput!) {
    createStudentProfile(adminInput: $adminInput) {
      userId
      degreeProgramId
      supervisorId
      status
      rollNumber
    }
  }
`;

export const UPDATE_STUDENT_PROFILE = gql`
  mutation UpdateStudentProfile($adminInput: StudentProfileUpdateInput!) {
    updateStudentProfile(adminInput: $adminInput) {
      userId
      degreeProgramId
      supervisorId
      status
      rollNumber
    }
  }
`;

export const CREATE_PROFESSOR_PROFILE = gql`
  mutation CreateProfessorProfile($adminInput: ProfessorProfileInput!) {
    createProfessorProfile(adminInput: $adminInput) {
      userId
      academicRank
      maxStudents
    }
  }
`;

export const UPDATE_PROFESSOR_PROFILE = gql`
  mutation UpdateProfessorProfile($adminInput: ProfessorProfileUpdateInput!) {
    updateProfessorProfile(adminInput: $adminInput) {
      userId
      academicRank
      maxStudents
    }
  }
`;

export const CREATE_RESEARCH_PHASE = gql`
  mutation CreateResearchPhase($adminInput: ResearchPhaseInput!) {
    createResearchPhase(adminInput: $adminInput) {
      id
      phaseType
      degreeLevel
      label
      sequenceNumber
      opensAt
      deadlineAt
      defenseDate
      gracePeriodEnabled
      isOpen
      status
      closedAt
      notifiedCount
    }
  }
`;

export const UPDATE_RESEARCH_PHASE = gql`
  mutation UpdateResearchPhase($adminInput: ResearchPhaseUpdateInput!) {
    updateResearchPhase(adminInput: $adminInput) {
      id
      phaseType
      degreeLevel
      label
      sequenceNumber
      opensAt
      deadlineAt
      defenseDate
      gracePeriodEnabled
      isOpen
      status
      closedAt
      notifiedCount
    }
  }
`;

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead($userInput: MarkNotificationsReadInput!) {
    markNotificationsRead(userInput: $userInput)
  }
`;

export const SCHEDULE_RESEARCH_DEFENSE = gql`
  mutation ScheduleDefense($adminInput: ScheduleDefenseInput!) {
    scheduleDefense(adminInput: $adminInput) {
      id
      kind
      proposalId
      progressReportId
      paperId
      defenseDate
      scheduledTime
      location
      submissionConfirmed
      phaseId
      currentStatus
    }
  }
`;

export const OPEN_RESEARCH_PHASE = gql`
  mutation OpenResearchPhase($adminInput: ResearchPhaseIdInput!) {
    openResearchPhase(adminInput: $adminInput) {
      id
      label
      status
      isOpen
      notifiedCount
    }
  }
`;

export const CLOSE_RESEARCH_PHASE = gql`
  mutation CloseResearchPhase($adminInput: ResearchPhaseIdInput!) {
    closeResearchPhase(adminInput: $adminInput) {
      id
      label
      status
      closedAt
    }
  }
`;

export const DELETE_RESEARCH_PHASE = gql`
  mutation DeleteResearchPhase($adminInput: ResearchPhaseDeleteInput!) {
    deleteResearchPhase(adminInput: $adminInput) {
      id
    }
  }
`;


export const SUBMIT_DEFENSE_VERDICT = gql`
  mutation SubmitDefenseVerdict($professorInput: DefenseVerdictInput!) {
    submitDefenseVerdict(professorInput: $professorInput) {
      id
      currentStatus
      outcomeComments
      requiresRedefense
    }
  }
`;

export const RESET_TO_NEW_BATCH = gql`
  mutation ResetToNewBatch($adminInput: ResetToNewBatchInput!) {
    resetToNewBatch(adminInput: $adminInput) {
      id
      label
      status
      startedAt
    }
  }
`;
