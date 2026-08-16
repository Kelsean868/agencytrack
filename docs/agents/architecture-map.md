# Architecture — source tree map

Moved out of CLAUDE.md (§ Architecture, original lines 209–243) on the router split.
This is a static snapshot. `npm run repomix` regenerates the authoritative tree every
session — prefer the pack over this file when they disagree.

## Architecture
```
src/
  context/        ← AuthContext, NotificationContext
  hooks/          ← useAuth, useSubmissions, useAgentMetrics
  services/       ← authService, submissionService, exportService,
                     goalsService, managerService, notificationService,
                     persistencyService, settlementService,
                     unlockService, userService, agentManagementService,
                     campaignService
  utils/          ← awardsEngine, campaignEngine, dateHelpers,
                     extractFields, formatters, gapAnalysis,
                     validators, weeklyChampions
  components/
    auth/         ← LoginScreen (SVG pattern background)
    awards/       ← AgentAwardsPanel, ManagerAwardsPanel
    campaigns/    ← CampaignCard, CampaignPanel
    dashboard/    ← AgentDashboard, ManagerDashboard,
                     KPICard, MotivationalCarousel
    gamification/ ← Leaderboard (AgentAvatar), BadgeGrid
    goals/        ← CommissionPlayground, GapAnalysisPanel
    manager/      ← MasterSheet, CompliancePanel, GoalsPanel,
                     MeetingMode (AgentAvatar), PersistencyPanel,
                     SettlementPanel, UserManagementPanel
    onboarding/   ← WelcomeScreen
    profile/      ← ProfileScreen, CareerPortal,
                     AgentReportDocument (react-pdf, hex only)
    submissions/  ← SubmissionViewer
    ui/           ← NotificationBell, NotificationDrawer,
                     ReportRangeModal, SyncIndicator
    wizard/       ← WizardForm (5 screens), CardStack,
                     CurrencyField, NumericField,
                     steps/ (Step1–Step9, NEVER MODIFY)
```

