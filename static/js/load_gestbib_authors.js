document.getElementById("btn-cargar").addEventListener("click", function () {
    // Wait a small delay for the table to be generated
    setTimeout(() => {
        const tabla = document.querySelector("table.dataTable")
        if (!tabla) {
            alert("La tabla aún no se ha cargado.");
            return;
        }

        const filas = Array.from(tabla.querySelectorAll("tbody tr"));
        const cabeceras = Array.from(tabla.querySelectorAll("thead th")).map(th => th.innerText.trim());

        const datos = filas.map(fila => {
            const celdas = Array.from(fila.querySelectorAll("td"));
            const obj = {};
            celdas.forEach((celda, i) => {
                const enlaces = Array.from(celda.querySelectorAll("a"));
            
                if (enlaces.length > 0) {
                    // If there are multiple links, we extract all of them
                    const textos = enlaces.map(a => a.innerText.trim());
                    const hrefs = enlaces.map(a => a.href);
                    obj[cabeceras[i]] = {
                        textos: textos,
                        enlaces: hrefs
                    };
                } else {
                    // If there are no links, only the plain text
                    obj[cabeceras[i]] = {
                        textos: [celda.innerText.trim()],
                        enlaces: []
                    };
                }
            });
            
            return obj;
        });

        console.log("Datos extraídos:", datos);

        // Send data to backend with fetch
        fetch(saveAuthorsUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie('csrftoken')
            },
            body: JSON.stringify(datos)
        })
        .then(response => response.json())
        .then(data => alert("Datos guardados correctamente"))
        .catch(error => console.error("Error al guardar:", error));
    }, 1000); // wait 1 second after clicking the button
});

// Function to get CSRF token (required by Django for POST)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === name + "=") {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}