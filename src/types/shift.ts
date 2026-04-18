/**
 * shift.ts
 * Types for shift schedule records sourced from external scheduling systems
 * and surfaced in APEx360.
 *
 * Shift data is imported into Bubble via API connector / webhook from the
 * agency's scheduling platform (e.g. Schedule Anywhere, Telestaff).
 */

// ---------------------------------------------------------------------------
// Shift status
// ---------------------------------------------------------------------------

/**
 * Possible states of a shift schedule record.
 */
export type ShiftStatus =
  | 'scheduled'   // Upcoming shift — not yet started
  | 'active'      // Currently in-progress
  | 'completed'   // Shift has ended
  | 'cancelled'   // Shift was cancelled before or during
  | 'no_show';    // Personnel did not report for a scheduled shift

// ---------------------------------------------------------------------------
// Shift schedule
// ---------------------------------------------------------------------------

/**
 * A single shift assignment for a personnel member.
 * Maps to the "Shift Schedules" data type in Bubble.
 *
 * These records are used in APEx to:
 *   - Allow evaluators to link evaluations to a specific shift/call
 *   - Provide context for progress note creation
 *   - Surface "last seen" data on roster dashboards
 */
export interface BubbleShiftSchedule {
  _id: string;
  /**
   * ISO 8601 date/time the shift is scheduled to start (or did start).
   */
  'Start DateTime': string;
  /**
   * ISO 8601 date/time the shift is scheduled to end (or did end).
   */
  'End DateTime': string;
  /**
   * External identifier from the scheduling platform
   * (e.g. Schedule Anywhere shift ID, Telestaff schedule number).
   * Used for de-duplication and cross-system linking.
   */
  'External Shift ID'?: string;
  /**
   * ISO 8601 date/time the personnel member was last recorded as active
   * on this shift (e.g. last CAD event, MDT ping, or check-in).
   * Used to populate the "last seen" field on roster views.
   */
  'Last Seen At'?: string;
  /**
   * Location or station assignment for this shift
   * (e.g. "Station 7", "District 3 HQ").
   */
  Location?: string;
  /**
   * Bubble _id of the Organization (agency) this shift belongs to.
   */
  Organization?: string;
  /**
   * The role or position the personnel member is filling on this shift
   * (e.g. "Paramedic", "Driver/EMT", "Supervisor").
   */
  Position?: string;
  /** Current status of the shift */
  Status: ShiftStatus;
  /**
   * Bubble _id of the BubbleUser (personnel member) this shift is assigned to.
   */
  Subject: string;
  /**
   * The unit or apparatus the personnel member is assigned to on this shift
   * (e.g. "Medic 7", "Rescue 3").
   */
  Unit?: string;
  /**
   * Optional free-text notes about this shift entry
   * (e.g. "Overtime coverage", "Training shift").
   */
  Notes?: string;
  created_date?: string;
  modified_date?: string;
}
