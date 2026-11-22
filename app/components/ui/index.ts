/**
 * Kit de componentes do Jasmin.
 *
 * REGRA: telas e abas novas montam a interface com estes componentes. Se faltar uma variação,
 * acrescente aqui (e em ui.css) em vez de criar um botão/aba/título "só da tela". Assim o app
 * inteiro muda de visual num lugar só.
 */
import "./ui.css";

export { Button, IconButton, TextButton, type ButtonVariant } from "./Button";
export { Tabs, type TabItem } from "./Tabs";
export { Section, SectionTitle } from "./Section";
export { Field, FieldLabel, FieldGrid } from "./Field";
export { Tag, Status, type Tone } from "./Badge";
export { Callout } from "./Callout";
export { Menu, type MenuItem } from "./Menu";
export { Avatar, PatientHeader, initialsOf } from "./Avatar";
export { cx } from "./cx";
