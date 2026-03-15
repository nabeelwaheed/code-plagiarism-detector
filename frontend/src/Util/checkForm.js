export function checkForm() {
    // Get all input elements within the form
    const inputs = document.getElementsByTagName("input");
    const btn = document.getElementById("btn");
    let allFilled = true;

    // Loop through inputs to check for validity (using native checkValidity() method)
    for (let i = 0; i < inputs.length; i++) {
        if (inputs[i].checkValidity() === false) {
            allFilled = false;
            break; // Exit the loop as soon as one field is invalid
        }
    }

    // Set the button's disabled property based on the allFilled flag
    btn.disabled = !allFilled;
}