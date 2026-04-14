import SunCalc from "suncalc";

export function sunBearingFromNorth(
  date: Date,
  lat: number,
  lon: number,
): number {
  const { azimuth } = SunCalc.getPosition(date, lat, lon);
  const deg = (azimuth * 180) / Math.PI + 180;
  return ((deg % 360) + 360) % 360;
}

export function sunAltitudeDeg(date: Date, lat: number, lon: number): number {
  return (SunCalc.getPosition(date, lat, lon).altitude * 180) / Math.PI;
}
