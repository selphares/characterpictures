const form = document.querySelector<HTMLFormElement>("#generator-form");
const result = document.querySelector<HTMLPreElement>("#result");

if (form && result) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const characterName = String(formData.get("characterName") ?? "");

    result.textContent = "Lade...";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ characterName })
      });

      const payload = await response.json();
      result.textContent = JSON.stringify(payload, null, 2);
    } catch (error) {
      result.textContent = `Fehler: ${String(error)}`;
    }
  });
}
