"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { apiRequest } from "../../lib/api";

const styles = [
  { id: "casual", label: "Casual", description: "Easy everyday pieces" },
  { id: "formal", label: "Formal", description: "Polished and put-together" },
  { id: "sporty", label: "Sporty", description: "Comfortable and active" },
  { id: "ethnic", label: "Ethnic", description: "Traditional and cultural" },
] as const;

const colors = [
  "Black", "White", "Navy", "Blue", "Beige", "Brown",
  "Grey", "Green", "Olive", "Red", "Pink", "Purple", "Yellow",
];

type Preferences = {
  favorite_colors: string[];
  preferred_styles: string[];
  disliked_colors: string[];
  gender_fit_notes: string;
};

const emptyPreferences: Preferences = {
  favorite_colors: [],
  preferred_styles: [],
  disliked_colors: [],
  gender_fit_notes: "",
};

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function PreferencesPage() {
  const showToast = useToast();
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest<Preferences & { user_id: string }>("/preferences")
      .then((data) => {
        if (!cancelled) {
          setPreferences({
            favorite_colors: data.favorite_colors,
            preferred_styles: data.preferred_styles,
            disliked_colors: data.disliked_colors,
            gender_fit_notes: data.gender_fit_notes,
          });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Preferences could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleColor(field: "favorite_colors" | "disliked_colors", color: string) {
    setPreferences((current) => {
      const selected = toggleValue(current[field], color);
      const otherField = field === "favorite_colors" ? "disliked_colors" : "favorite_colors";
      const other = selected.includes(color)
        ? current[otherField].filter((value) => value !== color)
        : current[otherField];
      return { ...current, [field]: selected, [otherField]: other };
    });
  }

  function addCustomColor() {
    const color = customColor.trim();
    if (!color) return;
    setPreferences((current) => ({
      ...current,
      favorite_colors: current.favorite_colors.some(
        (existing) => existing.toLowerCase() === color.toLowerCase(),
      )
        ? current.favorite_colors
        : [...current.favorite_colors, color],
      disliked_colors: current.disliked_colors.filter(
        (existing) => existing.toLowerCase() !== color.toLowerCase(),
      ),
    }));
    setCustomColor("");
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await apiRequest<Preferences & { user_id: string }>("/preferences", {
        method: "PUT",
        body: JSON.stringify(preferences),
      });
      setPreferences({
        favorite_colors: saved.favorite_colors,
        preferred_styles: saved.preferred_styles,
        disliked_colors: saved.disliked_colors,
        gender_fit_notes: saved.gender_fit_notes,
      });
      setNotice("Your style preferences are saved.");
      showToast("Your style preferences are saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="preferences-page">
      <header className="preferences-header">
        <Link className="auth-brand" href="/">Thread<span>.</span></Link>
        <Link className="preferences-back" href="/dashboard">← Back to your wardrobe</Link>
      </header>
      <section className="preferences-content">
        <p className="auth-eyebrow">YOUR STYLE, YOUR RULES</p>
        <h1>A little more <em>you.</em></h1>
        <p className="preferences-intro">
          Tell us what you love so future outfit ideas can feel a little more personal.
        </p>
        {loading ? (
          <div className="preferences-loading" role="status">Loading your preferences…</div>
        ) : (
          <form onSubmit={savePreferences}>
            <section className="preference-section">
              <div className="preference-heading">
                <span className="preference-number">01</span>
                <div><h2>Colors you reach for</h2><p>Choose your favorites; add a color of your own, too.</p></div>
              </div>
              <div className="color-options">
                {colors.map((color) => (
                  <button
                    className={`color-option ${preferences.favorite_colors.includes(color) ? "selected" : ""}`}
                    type="button"
                    key={color}
                    aria-pressed={preferences.favorite_colors.includes(color)}
                    onClick={() => toggleColor("favorite_colors", color)}
                  >
                    <span className={`preference-color-dot preference-dot-${color.toLowerCase()}`} />
                    {color}
                  </button>
                ))}
                {preferences.favorite_colors.filter((color) => !colors.includes(color)).map((color) => (
                  <button
                    className="color-option selected"
                    type="button"
                    key={color}
                    aria-pressed="true"
                    onClick={() => toggleColor("favorite_colors", color)}
                  >
                    <span className="preference-color-dot preference-dot-custom" />{color} ×
                  </button>
                ))}
              </div>
              <div className="custom-color-form">
                <label className="visually-hidden" htmlFor="custom-color">Add a favorite color</label>
                <input
                  id="custom-color"
                  maxLength={32}
                  placeholder="Add another color…"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                />
                <button type="button" onClick={addCustomColor}>Add color</button>
              </div>
            </section>

            <section className="preference-section">
              <div className="preference-heading">
                <span className="preference-number">02</span>
                <div><h2>Styles that feel like you</h2><p>Pick as many as you like.</p></div>
              </div>
              <div className="style-options">
                {styles.map((style) => {
                  const selected = preferences.preferred_styles.includes(style.id);
                  return (
                    <button
                      className={`style-option ${selected ? "selected" : ""}`}
                      type="button"
                      key={style.id}
                      aria-pressed={selected}
                      onClick={() => setPreferences((current) => ({
                        ...current,
                        preferred_styles: toggleValue(current.preferred_styles, style.id),
                      }))}
                    >
                      <span className="style-check" aria-hidden="true">{selected ? "✓" : "+"}</span>
                      <span><strong>{style.label}</strong><small>{style.description}</small></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="preference-section">
              <div className="preference-heading">
                <span className="preference-number">03</span>
                <div><h2>Colors you tend to skip</h2><p>We’ll keep these in mind when making suggestions.</p></div>
              </div>
              <div className="color-options">
                {colors.map((color) => (
                  <button
                    className={`color-option ${preferences.disliked_colors.includes(color) ? "selected disliked" : ""}`}
                    type="button"
                    key={color}
                    aria-pressed={preferences.disliked_colors.includes(color)}
                    onClick={() => toggleColor("disliked_colors", color)}
                  >
                    <span className={`preference-color-dot preference-dot-${color.toLowerCase()}`} />
                    {color}
                  </button>
                ))}
                {preferences.disliked_colors.filter((color) => !colors.includes(color)).map((color) => (
                  <button
                    className="color-option selected disliked"
                    type="button"
                    key={color}
                    aria-pressed="true"
                    onClick={() => toggleColor("disliked_colors", color)}
                  >
                    <span className="preference-color-dot preference-dot-custom" />{color} ×
                  </button>
                ))}
              </div>
            </section>

            <section className="preference-section preference-notes">
              <div className="preference-heading">
                <span className="preference-number">04</span>
                <div><h2>Fit notes, if you’d like</h2><p>Share any fit, gender, or modesty preferences to keep in mind.</p></div>
              </div>
              <label className="auth-field" htmlFor="fit-notes">
                Notes <span className="optional-label">Optional</span>
                <textarea
                  id="fit-notes"
                  maxLength={1000}
                  rows={4}
                  placeholder="For example: relaxed fits, longer hemlines, or no wool…"
                  value={preferences.gender_fit_notes}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    gender_fit_notes: event.target.value,
                  }))}
                />
              </label>
            </section>

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="preferences-notice" role="status">{notice}</p>}
            <button className="auth-submit preferences-save" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save my preferences"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
