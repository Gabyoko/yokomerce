import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  formatDateLong,
  formatDateShort,
  formatDeliveryDate,
  formatOrderTime,
  formatTime,
  formatTodayHeading,
  isValidISODate,
  todayInLima,
  weekdayOf,
} from "./dates";

// Lima es UTC-5 todo el año: las 03:00 UTC del 1 de noviembre son las 22:00 del 31 de octubre en Lima.
const SAT_31_OCT_10PM_LIMA = new Date("2026-11-01T03:00:00Z");
const SAT_31_OCT_10AM_LIMA = new Date("2026-10-31T15:00:00Z");

describe("todayInLima", () => {
  it("usa el día de Lima, no el de UTC", () => {
    expect(todayInLima(SAT_31_OCT_10PM_LIMA)).toBe("2026-10-31");
  });

  it("cambia de día a la medianoche de Lima", () => {
    expect(todayInLima(new Date("2026-11-01T04:59:00Z"))).toBe("2026-10-31");
    expect(todayInLima(new Date("2026-11-01T05:00:00Z"))).toBe("2026-11-01");
  });
});

describe("addDays y daysBetween", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-10-31", 0)).toBe("2026-10-31");
  });

  it("cuenta los días entre dos fechas", () => {
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-11-02", "2026-10-31")).toBe(-2);
    expect(daysBetween("2026-10-31", "2026-10-31")).toBe(0);
  });
});

describe("isValidISODate", () => {
  it("acepta fechas reales en formato AAAA-MM-DD", () => {
    expect(isValidISODate("2026-10-31")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
  });

  it("rechaza fechas que no existen o con otro formato", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("31/10/2026")).toBe(false);
    expect(isValidISODate("2026-10-31T10:00:00Z")).toBe(false);
    expect(isValidISODate("")).toBe(false);
  });

  it("las demás funciones lanzan error con una fecha inválida", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
  });
});

describe("weekdayOf", () => {
  it("devuelve la clave de businessHours", () => {
    expect(weekdayOf("2026-10-31")).toBe("sat");
    expect(weekdayOf("2026-11-01")).toBe("sun");
    expect(weekdayOf("2026-11-02")).toBe("mon");
  });
});

describe("formatDateLong y formatDateShort", () => {
  it("formato largo para el mensaje de WhatsApp", () => {
    expect(formatDateLong("2026-10-31")).toBe("sábado 31 de octubre");
    expect(formatDateLong("2026-09-01")).toBe("martes 1 de setiembre");
  });

  it("formato corto para listas", () => {
    expect(formatDateShort("2026-10-31")).toBe("Sáb 31 oct");
    expect(formatDateShort("2026-10-28")).toBe("Mié 28 oct");
  });
});

describe("formatDeliveryDate", () => {
  it("dice Hoy y Mañana según el día de Lima", () => {
    expect(formatDeliveryDate("2026-10-31", SAT_31_OCT_10PM_LIMA)).toBe("Hoy");
    expect(formatDeliveryDate("2026-11-01", SAT_31_OCT_10PM_LIMA)).toBe("Mañana");
    expect(formatDeliveryDate("2026-11-03", SAT_31_OCT_10PM_LIMA)).toBe("Mar 3 nov");
  });
});

describe("formatTime", () => {
  it("convierte a la hora de Lima", () => {
    expect(formatTime("2026-10-29T14:40:00Z")).toBe("9:40 a. m.");
    expect(formatTime("2026-10-29T15:28:00Z")).toBe("10:28 a. m.");
  });

  it("maneja mediodía, medianoche y la tarde", () => {
    expect(formatTime("2026-10-29T17:00:00Z")).toBe("12:00 p. m.");
    expect(formatTime("2026-10-29T05:05:00Z")).toBe("12:05 a. m.");
    expect(formatTime("2026-10-30T01:00:00Z")).toBe("8:00 p. m.");
  });
});

describe("formatTodayHeading", () => {
  it("con mayúscula inicial", () => {
    expect(formatTodayHeading(new Date("2026-10-28T15:00:00Z"))).toBe("Miércoles 28 de octubre");
  });
});

describe("formatOrderTime", () => {
  const now = SAT_31_OCT_10AM_LIMA;

  it("hace menos de un minuto", () => {
    expect(formatOrderTime("2026-10-31T14:59:30Z", now)).toBe("Hace un momento");
  });

  it("hace minutos", () => {
    expect(formatOrderTime("2026-10-31T14:48:00Z", now)).toBe("Hace 12 min");
    expect(formatOrderTime("2026-10-31T14:01:00Z", now)).toBe("Hace 59 min");
  });

  it("hoy, hace más de una hora: muestra la hora", () => {
    expect(formatOrderTime("2026-10-31T13:40:00Z", now)).toBe("8:40 a. m.");
  });

  it("ayer en Lima, aunque en UTC sea el mismo día", () => {
    // 01:00 UTC del 31 = 8:00 p. m. del 30 en Lima
    expect(formatOrderTime("2026-10-31T01:00:00Z", now)).toBe("Ayer");
  });

  it("antes de ayer: fecha corta", () => {
    expect(formatOrderTime("2026-10-26T20:00:00Z", now)).toBe("Lun 26 oct");
  });
});
