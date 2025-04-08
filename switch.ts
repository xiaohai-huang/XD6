import five from "johnny-five";

var board = new five.Board();

board.on("ready", function () {
  var button = new five.Button({ pin: 27, isPullup: true, invert: false });
  var led = new five.Led(13);

  button.on("up", function () {
    led.off();
    console.log("Button is up");
  });
  button.on("hold", function () {
    led.on();
    console.log("Button is held");
  });

  button.on("down", function () {
    led.on();
    console.log("Button is down");
  });
});
