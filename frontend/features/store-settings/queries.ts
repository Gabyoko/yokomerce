import { cache } from "react";

import { getMyStore, listZones } from "./api";

/** Tienda del dueño para componentes de servidor; una sola petición por render. */
export const loadMyStore = cache(() => getMyStore());

export const loadMyZones = cache(() => listZones());
