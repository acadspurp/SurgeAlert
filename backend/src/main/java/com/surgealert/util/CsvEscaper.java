package com.surgealert.util;

public final class CsvEscaper {

    private CsvEscaper() {}

    public static String cell(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw;
        if (s.contains("\"")) {
            s = s.replace("\"", "\"\"");
        }
        boolean needsQuotes = s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r");
        return needsQuotes ? ("\"" + s + "\"") : s;
    }
}
