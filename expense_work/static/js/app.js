document.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("mobileMenu");
  const sidebar = document.getElementById("sidebar");
  if (menu && sidebar) menu.addEventListener("click", () => sidebar.classList.toggle("sidebar-open"));

  // Keep category choices aligned with expense/income type.
  const typeRadios = document.querySelectorAll('input[name="kind"]');
  const categorySelect = document.getElementById("categorySelect");
  function filterCategories() {
    if (!categorySelect) return;
    const selectedType = document.querySelector('input[name="kind"]:checked')?.value || "expense";
    [...categorySelect.options].forEach(option => {
      if (!option.value) return;
      option.hidden = option.dataset.kind !== selectedType;
      option.disabled = option.dataset.kind !== selectedType;
    });
    if (categorySelect.selectedOptions[0]?.disabled) categorySelect.value = "";
  }
  typeRadios.forEach(radio => radio.addEventListener("change", filterCategories));
  filterCategories();

  // Soft dismiss for flash messages.
  document.querySelectorAll(".flash").forEach(flash => {
    const close = flash.querySelector("button");
    if (close) close.addEventListener("click", () => flash.remove());
  });
});
