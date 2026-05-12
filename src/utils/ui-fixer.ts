export function setupUIFixer(): () => void {
	const observer = new MutationObserver((mutations) => {
		let shouldApply = false;
		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				// We don't need to check specific nodes, just run it if any nodes were added
				// since the view rendering might be batched
				shouldApply = true;
				break;
			}
		}
		if (shouldApply) {
			applyNestedPathFix(activeDocument.body);
		}
	});

	observer.observe(activeDocument.body, {
		childList: true,
		subtree: true
	});

	// Run once initially in case we missed it
	applyNestedPathFix(activeDocument.body);

	return () => observer.disconnect();
}

function applyNestedPathFix(container: HTMLElement) {
	// Find all setting names that say "Has nested path"
	const nameEls = Array.from(container.querySelectorAll('.input-row-label'));
	
	for (const nameEl of nameEls) {
		if (nameEl.textContent === 'Has nested path') {
			const settingItem = nameEl.closest('.input-row') as HTMLElement;
			if (!settingItem) continue;

			// The text field is exactly the next setting item sibling
			let nextSettingItem = settingItem.nextElementSibling as HTMLElement;
			
			// Ensure we got the right sibling
			if (nextSettingItem && nextSettingItem.classList.contains('input-row')) {
				const nextNameEl = nextSettingItem.querySelector('.input-row-label');
				
				if (nextNameEl && nextNameEl.textContent === 'Nested path (after the dot)') {
					
					// Setup the visibility link
					const checkbox = settingItem.querySelector('input[type="checkbox"]') as HTMLInputElement;
					if (!checkbox) continue;

					const updateVisibility = () => {
						const container = checkbox.closest('.checkbox-container');
						const isChecked = container ? container.classList.contains('is-enabled') : checkbox.checked;
						nextSettingItem.style.display = isChecked ? '' : 'none';
					};

					// Prevent adding multiple listeners
					if (!checkbox.hasAttribute('data-ui-fixed')) {
						checkbox.setAttribute('data-ui-fixed', 'true');
						
						// Listen for changes on the checkbox
						checkbox.addEventListener('change', updateVisibility);
						// Also listen for clicks on the label container just in case
						const container = checkbox.closest('.checkbox-container');
						if (container) {
							container.addEventListener('click', () => activeWindow.setTimeout(updateVisibility, 50));
						}
					}

					// Initial update
					updateVisibility();
				}
			}
		}
	}
}
