// Screen name constants (React Navigation).
export const SCREENS = Object.freeze({
  // Common
  /** Bottom tab (Home). Inner stack screen uses `DashboardHome` to avoid duplicate names. */
  Dashboard: 'Dashboard',
  DashboardHome: 'DashboardHome',
  /** Bottom tab: analytics (CA-1). Academy browse: Home stack screen + slide-out menu. */
  AnalyticsStack: 'AnalyticsStack',
  AcademyStack: 'AcademyStack',
  PlayerAnalytics: 'PlayerAnalytics',
  PlayerMatchAnalytics: 'PlayerMatchAnalytics',
  EventDetails: 'EventDetails',
  Profile: 'Profile',
  Notifications: 'Notifications',
  Teams: 'Teams',
  SubscriptionPlans: 'SubscriptionPlans',

  // Auth
  Login: 'Login',
  AdminLogin: 'AdminLogin',
  Register: 'Register',
  ForgotPassword: 'ForgotPassword',
  ResetPassword: 'ResetPassword',
  VerifyAccount: 'VerifyAccount',
  PasswordLogin: 'PasswordLogin',

  // Mobile onboarding (post-auth)
  MobileProfileSetup: 'MobileProfileSetup',
  MobileSportsSelection: 'MobileSportsSelection',

  // Public
  OnBoardingScreen: 'OnBoardingScreen',
  Landingpage: 'Landingpage',
  Home: 'Home',
  Contact: 'Contact',
  /** Bottom tab wrapping `EventsStackNavigator` — must differ from inner stack screen names. */
  EventsStack: 'EventsStack',
  /** Events tab stack: browse list (same screen as web; name distinct from tab). */
  EventsHome: 'EventsHome',
  /** Public stack only — distinct from the logged-in events tab (`EventsHome`). */
  PublicBrowseEvents: 'PublicBrowseEvents',
  Events: 'Events',
  BrowseAcademies: 'BrowseAcademies',
  AcademyScreen: 'AcademyScreen',
  AcademyPage: 'AcademyPage',
  BrowseCoaches: 'BrowseCoaches',
  CoachScreen: 'CoachScreen',
  CoachPage: 'CoachPage',
  BrowseCourts: 'BrowseCourts',
  CourtScreen: 'CourtScreen',
  CourtPage: 'CourtPage',

  // Pending
  KycUpload: 'KycUpload',
  PendingApproval: 'PendingApproval',

  // Player-specific
  SubscriptionDetails: 'SubscriptionDetails',
  BookCourt: 'BookCourt',
  PlayerBrowseCourts: 'PlayerBrowseCourts',
  PlayerCourtDetails: 'PlayerCourtDetails',
  MyBookings: 'MyBookings',
  BookingDetails: 'BookingDetails',

  /** Player menu / stack (parity with web player shell) */
  PlayerFindCoach: 'PlayerFindCoach',
  TeamInvites: 'TeamInvites',
  MyEvents: 'MyEvents',
  MyMatches: 'MyMatches',
  EventTracker: 'EventTracker',
  AttendedMatches: 'AttendedMatches',
  MySubscriptions: 'MySubscriptions',
  Settings: 'Settings',

  /** Register an existing team for an event (checkout / pay-later parity with web). */
  TeamRegistration: 'TeamRegistration',

  /** Organizer bottom tabs (order: Home, Teams, Events, Staff, Profile) */
  OrganizerTabHome: 'OrganizerTabHome',
  OrganizerTabTeams: 'OrganizerTabTeams',
  OrganizerTabEvents: 'OrganizerTabEvents',
  OrganizerTabStaff: 'OrganizerTabStaff',
  OrganizerTabProfile: 'OrganizerTabProfile',

  /** Organizer stacks */
  OrganizerDashboardHome: 'OrganizerDashboardHome',
  OrganizerSports: 'OrganizerSports',
  /** Organizer: full sports configuration wizard (parity with web admin Sports organizer mode). */
  OrganizerSportConfiguration: 'OrganizerSportConfiguration',
  OrganizerContactAdmin: 'OrganizerContactAdmin',
  OrganizerMyQueriesScreen: 'OrganizerMyQueriesScreen',
  OrganizerTeamsHome: 'OrganizerTeamsHome',
  OrganizerTeamDetail: 'OrganizerTeamDetail',
  OrganizerCreateTeam: 'OrganizerCreateTeam',
  OrganizerEditTeam: 'OrganizerEditTeam',
  OrganizerMyEvents: 'OrganizerMyEvents',
  OrganizerCreateEvent: 'OrganizerCreateEvent',
  OrganizerEditEvent: 'OrganizerEditEvent',
  OrganizerMatchSchedule: 'OrganizerMatchSchedule',
  OrganizerEventRegistrations: 'OrganizerEventRegistrations',
  OrganizerRescheduleEvent: 'OrganizerRescheduleEvent',
  OrganizerStaffHome: 'OrganizerStaffHome',
  OrganizerProfileHome: 'OrganizerProfileHome',

  /** Organizer parity: revenue, scorers, schedule tools, comms */
  OrganizerEventAnnouncement: 'OrganizerEventAnnouncement',
  OrganizerEventRevenue: 'OrganizerEventRevenue',
  OrganizerRevenueAnalytics: 'OrganizerRevenueAnalytics',
  OrganizerScorers: 'OrganizerScorers',
  OrganizerEventScorers: 'OrganizerEventScorers',
  OrganizerAddTeamToEvent: 'OrganizerAddTeamToEvent',
  OrganizerEventStaff: 'OrganizerEventStaff',
  OrganizerCoachTeams: 'OrganizerCoachTeams',
  OrganizerBulkNotifications: 'OrganizerBulkNotifications',
  OrganizerRegisteredPlayers: 'OrganizerRegisteredPlayers',
});

