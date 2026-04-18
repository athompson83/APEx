/**
 * progressNote.ts
 * Types for progress notes — freeform observations written by trainers
 * about a trainee's performance, behavior, or development during a shift
 * or training period.
 */

// ---------------------------------------------------------------------------
// Progress note reason categories
// ---------------------------------------------------------------------------

/**
 * Predefined reason categories for creating a progress note.
 * Allows filtering and reporting on note types without parsing free text.
 */
export type ProgressNoteReason =
  | 'performance'        // General performance observation
  | 'commendation'       // Positive recognition / going above and beyond
  | 'area_for_growth'    // Constructive feedback on development needs
  | 'clinical'           // Clinical decision-making or patient care note
  | 'behavioral'         // Professionalism, teamwork, communication
  | 'attendance'         // Tardiness, absences, shift conduct
  | 'equipment'          // Equipment handling, vehicle check, supply issues
  | 'policy'             // Policy or protocol adherence issue
  | 'safety'             // Safety concern or incident
  | 'other';             // Miscellaneous — requires explanation in note body

// ---------------------------------------------------------------------------
// Progress note
// ---------------------------------------------------------------------------

/**
 * A progress note written by a trainer, supervisor, or reviewer
 * about a trainee.
 * Maps to the "Progress Notes" data type in Bubble.
 */
export interface BubbleProgressNote {
  _id: string;
  /**
   * The body of the progress note — free-form text written by the creator.
   * This is the primary content field.
   */
  Note: string;
  /**
   * Categorized reason for the note.
   * Drives icon, color, and filter UI in the app.
   */
  Reason: ProgressNoteReason;
  /**
   * Bubble _id of the BubbleUser (trainee/subject) this note is about.
   */
  Subject: string;
  /**
   * Bubble _id of the BubbleUser who wrote the note.
   * Typically a trainer, FTO, or supervisor.
   */
  Creator: string;
  /**
   * Bubble _id of the BubbleProgramRoster entry this note is associated with.
   * Optional — a note may exist outside of a formal program context.
   */
  'Program Roster'?: string;
  /**
   * Bubble _id of the BubbleProgramPhase this note relates to.
   * Helps scope notes to a specific training period.
   */
  'Program Phase'?: string;
  /**
   * Bubble _id of a BubbleShiftSchedule entry this note is associated with.
   * Links the note to a specific shift for timeline context.
   */
  'Related Shift'?: string;
  /**
   * Bubble _id of a BubbleEvalFormLog this note is associated with.
   * Allows cross-referencing notes with specific evaluations.
   */
  'Related Eval'?: string;
  /**
   * When true, this note is visible to the subject (trainee).
   * When false, it is an internal trainer/supervisor note only.
   */
  'Visible to Subject': boolean;
  /**
   * When true, the subject (trainee) has acknowledged/read this note.
   * Only relevant when Visible to Subject is true.
   */
  'Subject Acknowledged': boolean;
  /** ISO 8601 date/time the subject acknowledged the note */
  'Acknowledged At'?: string;
  created_date?: string;
  modified_date?: string;
}
