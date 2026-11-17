package com.habituate.api.habits;

import java.util.List;

/** The fixed palette of per-habit tower colours (design-review board 12). The
 * stored value is the palette KEY; the hex values live in the mobile client. */
public final class TowerColors {

    public static final List<String> KEYS = List.of(
            "coral", "amber", "lime", "green", "teal", "cyan",
            "sky", "indigo", "violet", "pink", "rose", "slate");

    private TowerColors() {
    }

    public static boolean isValid(String key) {
        return key != null && KEYS.contains(key);
    }
}
