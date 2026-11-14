import { test } from "node:test";
import assert from "node:assert/strict";
import { wrap } from "../src/ui/text.js";

test("zawija po słowach z polskimi znakami", () =>
  assert.equal(wrap("Zażółć gęślą jaźń i pójdź dalej", 12), "Zażółć gęślą\njaźń i pójdź\ndalej"));
test("zachowuje akapity i łamania", () => assert.equal(wrap("a b\n\nc\nd", 80), "a b\n\nc\nd"));
test("tnie zbyt długie słowa", () => assert.equal(wrap("abcdefghijklmno", 10), "abcdefghij\nklmno"));
test("width < 10 traktowane jak 10", () => assert.equal(wrap("abcdefghijklmno", 3), "abcdefghij\nklmno"));
