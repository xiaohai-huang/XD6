import Joint from "./lib/Joint.ts";

export async function Test([J1, J2]: Joint[]) {
  await J2.home();
  await J1.home();

  await J1.rotateTo(90);
  await J2.rotateTo(126);

  for (let i = 0; i < 10; i++) {
    J1.rotateBy(20);
    await J2.rotateTo(40);

    J1.rotateBy(-20);
    await J2.rotateTo(100);
  }
}
