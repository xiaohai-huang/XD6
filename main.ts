// var five = require("johnny-five");
import five from "johnny-five";
import Joint from "./lib/Joint.ts";
var board = new five.Board();

board.on("ready", function () {
  var led = new five.Led(13);

  const J2 = new Joint({ homeSwitchPin: 26, stepPin: 27, dirPin: 28 });
  J2.onHomeSwitchActivate(() => {
    console.log("Home switch activated");
  });
  J2.onHomeSwitchDeactivate(() => {
    console.log("Home switch deactivated");
  });
  board.repl.inject({
    J2: J2,
  });
});
