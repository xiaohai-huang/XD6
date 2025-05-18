import EventEmitter from "events";

// Define a constant for the number of state transitions per detent click.
// This is typically 4 for common mechanical rotary encoders with detents,
// as each detent corresponds to a full cycle of the two quadrature signals
// (00 -> 01 -> 11 -> 10 -> 00 or the reverse).
const TRANSITIONS_PER_DETENT = 4;

// Lookup table for valid state transitions to determine direction (delta).
// The key is a 4-bit value formed by (lastEncoded << 2) | encoded.
// Values: 1 for clockwise, -1 for counter-clockwise.
// Any other 4-bit value represents an invalid or skipped transition, likely due to bounce.
const DELTA_LOOKUP = {
  // Clockwise transitions: (last << 2) | current
  0b0001: 1, // 00 -> 01
  0b0111: 1, // 01 -> 11
  0b1110: 1, // 11 -> 10
  0b1000: 1, // 10 -> 00

  // Counter-clockwise transitions: (last << 2) | current
  0b0010: -1, // 00 -> 10
  0b1011: -1, // 10 -> 11
  0b1101: -1, // 11 -> 01
  0b0100: -1, // 01 -> 00
};

/**
 * Represents a rotary encoder connected to a board (e.g., Arduino via Johnny-Five).
 * Emits a 'change' event when the encoder is rotated past a detent.
 */
class Encoder extends EventEmitter {
  /**
   * @param {object} board - The board instance (e.g., from Firmata).
   * @param {number} pinA - The digital pin connected to encoder channel A.
   * @param {number} pinB - The digital pin connected to encoder channel B.
   */
  constructor(board, pinA, pinB) {
    super();
    this.board = board;
    this.pinA = pinA;
    this.pinB = pinB;

    // Position in terms of detents. Starts at 0.
    this.detentPosition = 0;
    // Raw count of quadrature state transitions (4 transitions per detent).
    this.transitionCount = 0;
    // Stores the previous state (00, 01, 10, 11) represented as a 2-bit number.
    this.lastEncoded = 0;

    // Current raw values of pins A and B (0 or 1).
    this.aValue = 0;
    this.bValue = 0;

    // Track initial reads to ensure both pins have been read at least once
    // before processing state changes or initializing `lastEncoded`.
    this.initialReadsComplete = { a: false, b: false };
    // Flag to indicate when the encoder is fully initialized (initial reads complete).
    this.isInitialized = false;

    // Configure pins as inputs with pull-up resistors.
    // Rotary encoders typically use pull-ups and connect to ground when active.
    // Use board.MODES.INPUT if external pull-ups are used.
    board.pinMode(pinA, board.MODES.PULLUP);
    board.pinMode(pinB, board.MODES.PULLUP);

    // Set up digital read callbacks for each pin.
    // These callbacks are triggered whenever the state of the pin changes.
    board.digitalRead(pinA, (value) => {
      this.aValue = value;
      this.handlePinRead("a");
    });

    board.digitalRead(pinB, (value) => {
      this.bValue = value;
      this.handlePinRead("b");
    });
  }

  /**
   * Handles a digital read event from either pin A or B.
   * It updates the pin value and checks if initial reads are complete.
   * Once initialized, it calls the update logic.
   * @param {'a' | 'b'} pin - The pin that triggered the read ('a' or 'b').
   */
  handlePinRead(pin) {
    if (pin === "a") {
      this.initialReadsComplete.a = true;
    } else if (pin === "b") {
      this.initialReadsComplete.b = true;
    }

    // Check if both initial reads are complete and the encoder state hasn't been initialized yet.
    if (
      this.initialReadsComplete.a &&
      this.initialReadsComplete.b &&
      !this.isInitialized
    ) {
      this.initializeEncoder();
    } else if (this.isInitialized) {
      // If the encoder is already initialized, process the current state change.
      this.update();
    }
    // If initial reads aren't complete and not yet initialized, we wait until both are ready.
  }

  /**
   * Initializes the encoder's internal state after the first readings
   * from both pins A and B are available. Sets the initial position to 0
   * and emits the first 'change' event.
   */
  initializeEncoder() {
    // Calculate the initial encoded state from the first readings.
    this.lastEncoded = (this.aValue << 1) | this.bValue;
    this.detentPosition = 0;
    this.transitionCount = 0; // Ensure counts are starting from 0
    this.isInitialized = true;

    // Emit the initial position (0) once the encoder is ready.
    this.emit("change", this.detentPosition);
  }

  /**
   * Processes the current state of the encoder pins to detect rotation.
   * Updates the transition count and detent position, emitting 'change'
   * if the detent position has changed.
   */
  update() {
    // Ensure the encoder has been fully initialized before processing state changes.
    if (!this.isInitialized) {
      return;
    }

    // Get the current encoded state (00, 01, 10, or 11).
    const encoded = (this.aValue << 1) | this.bValue;

    // If the state hasn't changed from the last known state, or if the transition
    // represents moving backwards or is an invalid bounce sequence (not in DELTA_LOOKUP),
    // we ignore this update.
    if (encoded === this.lastEncoded) {
      return; // No change in state
    }

    // Combine the last state and the current state to get a 4-bit transition value.
    const transitionValue = (this.lastEncoded << 2) | encoded;

    // Look up the direction (delta) for this transition.
    const delta = DELTA_LOOKUP[transitionValue];

    // If the delta is undefined, it means the transition was not a valid step
    // in the quadrature sequence (likely due to bouncing or noise). Ignore it.
    if (delta === undefined) {
      // Optional: console.warn could be used here for debugging invalid transitions.
      // console.warn(`Invalid encoder transition: ${this.lastEncoded.toString(2).padStart(2, '0')} -> ${encoded.toString(2).padStart(2, '0')}`);
      return;
    }

    // Update the raw transition count based on the direction.
    this.transitionCount += delta;

    // Store the current state to be the 'last' state for the next update.
    this.lastEncoded = encoded;

    // Calculate the new detent position. Using Math.floor means position changes
    // only after a full sequence of 4 transitions in one direction.
    const newDetentPosition = Math.floor(
      this.transitionCount / TRANSITIONS_PER_DETENT
    );

    // If the calculated detent position has changed from the previous one,
    // update the position and emit the 'change' event.
    if (newDetentPosition !== this.detentPosition) {
      this.detentPosition = newDetentPosition;
      this.emit("change", this.detentPosition);
    }
  }

  /**
   * Gets the current position of the encoder in terms of detents.
   * @returns {number} The current detent position.
   */
  getPosition() {
    return this.detentPosition;
  }

  /**
   * Gets the raw count of quadrature state transitions.
   * This count increases by 4 for each detent clicked in one direction
   * and decreases by 4 for each detent clicked in the other.
   * Useful for debugging or applications needing finer granularity
   * than detents.
   * @returns {number} The raw transition count.
   */
  getTransitionCount() {
    return this.transitionCount;
  }

  /**
   * Resets the encoder's detent position and transition count back to zero.
   * Does not affect the current electrical state of the pins.
   * Emits a 'change' event with position 0 if the position was non-zero.
   */
  reset() {
    this.transitionCount = 0;
    const oldDetentPosition = this.detentPosition;
    this.detentPosition = 0;

    // Only emit 'change' if the position was something other than 0 before the reset.
    if (oldDetentPosition !== 0) {
      this.emit("change", this.detentPosition);
    }
    // No need to reset isInitialized or initialReadsComplete flags here,
    // as the encoder is already in an operational state if reset is called.
  }

  // Optional: Add a method to clean up listeners if the encoder instance
  // needs to be explicitly disposed of, though many libraries handle this
  // when the board connection is closed.
  // cleanup() {
  //   // Depending on the board library, you might need methods here
  //   // to explicitly remove the digitalRead listeners if they are not
  //   // automatically cleaned up.
  //   // e.g., this.board.removeListener('digitalRead', this.pinA, ...);
  //   // e.g., this.board.removeListener('digitalRead', this.pinB, ...);
  // }
}

export default Encoder;
