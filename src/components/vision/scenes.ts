// The Big picture's seven scenes, in words. Each scene is what changed, in at
// most two short sentences; *starred* words run hot. Names and numbers come
// from the demo's own world (Detroit's City Lead, Saturday's back walker, how
// many are coming), so this story and the City Circles screen never disagree.

export interface SceneWords {
  /** Small caps above the title. */
  name: string;
  title: string;
  lines: [string, string];
}

export interface StoryCast {
  /** Detroit's City Lead. */
  lead: string;
  /** Saturday's back walker. */
  sweep: string;
  /** How many are coming on Saturday, the first-timer included. */
  coming: number;
}

export const SCENE_COUNT = 7;

export function sceneWords({ lead, sweep, coming }: StoryCast): SceneWords[] {
  return [
    {
      name: "The world",
      title: "Your city, *moving.*",
      lines: ["Every light is people walking together: a meetup, a welcome, a first mile.", "Nobody is tracked. The city just glows when community happens."],
    },
    {
      name: "The person",
      title: "One poster. *One doorway.*",
      lines: ["A first-timer in Detroit sees a QR code at the library: “Walk with us Saturday.”", "One page, one tap, and she's in. No app, no account."],
    },
    {
      name: "The place",
      title: "A walk that *fits.*",
      lines: ["She needs step-free paths, shade and somewhere to rest.", `Route B fits — and the screen says why, and what ${lead} has checked.`],
    },
    {
      name: "The community",
      title: "Nobody walks in *alone.*",
      lines: [`On Thursday, ${lead}'s co-pilot spotted Saturday had no back walker. ${sweep} said yes.`, `Saturday, 8:00: ${coming} people, one riverwalk, and nobody finishes last.`],
    },
    {
      name: "The partner",
      title: "A partner funds *the next walks.*",
      lines: ["A local outfitter pays for two more Detroit walks.", `Kayla's week shows the money in and ${lead}'s load, side by side.`],
    },
    {
      name: "The change",
      title: "The city gets *better.*",
      lines: ["Members vote part of the giving fund to shade and benches on Route A.", `${lead} confirms a step-free way around the stairs. Now both routes fit.`],
    },
    {
      name: "The network",
      title: "Seven cities. *One summer.*",
      lines: ["Year 10's opening day: a baton of light runs from Chicago, where it began, to Los Angeles.", "Each city adds its moment, and every check-in adds a thread to the summer's artwork."],
    },
  ];
}
