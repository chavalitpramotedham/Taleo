/** Book cloths in the house colours - each story is bound in one, picked
 *  from its id, so the same book always has the same cover (in the app and
 *  in a shared link's preview card). */
export const CLOTHS: [string, string][] = [
  ["#7d3530", "#5a2321"], // oxblood
  ["#4f6040", "#35422b"], // forest
  ["#35506a", "#243a4f"], // deep blue
  ["#7a5a2c", "#58401d"], // ochre leather
  ["#5d3a55", "#42283c"], // plum
];

export function clothFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CLOTHS[h % CLOTHS.length];
}
