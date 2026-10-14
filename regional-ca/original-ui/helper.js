function getOptionsHTML(values, labels, currentValue) {
    return Object.values(values)
        .map(
            (value) =>
                `<option ${value === null ? 'disabled' : ''} ${value === currentValue ? 'selected' : ''} value=${Number(value)}>${
                    labels[value]
                }</option>`
        )
        .join('');
}
