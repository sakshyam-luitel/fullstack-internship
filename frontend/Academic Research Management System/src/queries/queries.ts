import { gql } from "@apollo/client";

export const CURRENT_USER_QUERY = gql`
    query CurrentUser {
        currentUser {
            id
            departmentId
            name
            email
            role
            createdAt
            avatarUrl
        }
    }
`;

export const DEPARTMENTSQUERY = gql`
    query Departments {
        departments {
            id
            name
            code
        }
    }
`;

export const USERSQUERY = gql`
    query Users{
        users{
            id
            departmentId
            name
            email
            password
            role
            createdAt
            degreeProgramId
            degreeLevel
        }
    }
`;

export const PROFILES_QUERY = gql`
  query Profiles {
    profiles {
      userId userName role departmentId departmentName degreeProgramName degreeLevel
      supervisorName supervisorId academicRank maxStudents status rollNumber
    }
  }
`;

export const DEGREE_PROGRAMS_QUERY = gql`
    query DegreePrograms {
        degreePrograms {
            id
            name
            level
            departmentId
        }
    }
`;

export const RESEARCH_PHASES_QUERY = gql`
  query ResearchPhases {
    researchPhases {
      id phaseType degreeLevel label sequenceNumber opensAt deadlineAt defenseDate gracePeriodEnabled isOpen hasEnded
    }
  }
`;

const DEFENSE_FIELDS = `
  id kind proposalId progressReportId paperId paperTitle defenseDate scheduledTime location submissionConfirmed
  phaseId phaseLabel currentStatus degreeLevel studentNames supervisorName panelNames panelProfessorIds
  reportDocumentKind reportDocumentId reportFilename originalFilename
`;

export const DEFENSE_CANDIDATES_QUERY = gql`
  query DefenseCandidates($degreeLevel: String!, $kind: String!) {
    defenseCandidates(degreeLevel: $degreeLevel, kind: $kind) {
      kind targetId title status studentNames supervisorName phaseId phaseLabel suggestedDate reportFilename
      defense { ${DEFENSE_FIELDS} }
    }
  }
`;

export const MY_PANEL_DEFENSES_QUERY = gql`
  query MyPanelDefenses {
    myPanelDefenses { ${DEFENSE_FIELDS} }
  }
`;

export const MY_NOTIFICATIONS_QUERY = gql`
  query MyNotifications {
    myNotifications {
      id type title message isRead createdAt phaseLabel phaseType opensAt deadlineAt defenseDate
    }
  }
`;

export const PROPOSAL_SUBMISSION_HISTORY_QUERY = gql`
  query ProposalSubmissionHistory($proposalId: UUID!) {
    proposalSubmissionHistory(proposalId: $proposalId) {
      id entityType phaseLabel submittedByName status reviewedByName comments originalFilename createdAt
    }
  }
`;

export const DEFENSE_PANEL_QUERY = gql`
  query DefensePanel($defenseId: UUID!) {
    defensePanel(defenseId: $defenseId) { id defenseId professorId professorName createdAt }
  }
`;
