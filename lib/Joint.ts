import five from "johnny-five";

class Joint {
  private stepper: five.Stepper;
  private homeSwitch: five.Button;
  private isHoming: boolean = false;
  private homeSwitchPressed: boolean = false;
  private isMoving: boolean = false;

  constructor({
    stepPin,
    dirPin,
    homeSwitchPin,
  }: {
    stepPin: number;
    dirPin: number;
    homeSwitchPin: number;
  }) {
    this.stepper = new five.Stepper({
      type: five.Stepper.TYPE.DRIVER,
      stepsPerRev: 200,
      pins: {
        step: stepPin,
        dir: dirPin,
      },
    });

    this.homeSwitch = new five.Button({
      pin: homeSwitchPin,
      isPullup: true,
      invert: false,
    });

    this.homeSwitch.on("press", () => {
      this.homeSwitchPressed = true;
      if (this.isMoving) {
        console.log("Limit switch hit! Stopping movement.");
        this.isMoving = false; // Stop movement
      }
    });

    this.homeSwitch.on("release", () => {
      this.homeSwitchPressed = false;
    });
  }

  move(
    steps: number,
    direction: number,
    accel: number,
    decel: number,
    callback: () => void
  ) {
    if (this.homeSwitchPressed) {
      console.log("Cannot move: Limit switch is pressed.");
      return;
    }

    this.isMoving = true;
    this.stepper.step({ steps, direction, accel, decel }, () => {
      this.isMoving = false;
      callback();
    });
  }

  onHomeSwitchActivate(callback: () => void) {
    this.homeSwitch.on("press", callback);
  }

  onHomeSwitchDeactivate(callback: () => void) {
    this.homeSwitch.on("release", callback);
  }

  home(callback: () => void) {
    if (this.isHoming) return;
    this.isHoming = true;

    const moveStep = () => {
      if (this.homeSwitchPressed) {
        console.log("Homing stopped: Limit switch is pressed.");
        this.isHoming = false;
        callback();
        return;
      }

      this.stepper.step({ steps: 1, direction: 0, accel: 0, decel: 0 }, () => {
        if (!this.homeSwitchPressed) {
          moveStep();
        } else {
          this.isHoming = false;
          callback();
        }
      });
    };

    moveStep();
  }
}

export default Joint;
