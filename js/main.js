var GlobalCollectionName = 0;
//massima dimensione del file
var maxDimension = 5000000;
//password per la cancellazione manuale di tutti i file sul server
var pass1 = "manifest";


//SCRIPT
$(document).ready(function ($) {
    $(document).on('submit', '#formautore', function (event) {
        event.preventDefault();
    });
    $(document).on('submit', '#formupload', function (event) {
        event.preventDefault();
    });
    $('#formupload input').change(function () {
        $('#formupload p').text(this.files.length + " file selezionati");
    });
    $(document).on('submit', '#listOfFiles', function (event) {
        event.preventDefault();
    });
    //imposta data di oggi nel form
    var date = new Date();
    let today = date.toLocaleDateString().split('/');
    let day = today[0];
    if (day <= 9) {
        day = '0' + day;
    }
    let month = today[1];
    if (month <= 9) {
        month = '0' + month;
    }
    let year = today[2];
    document.getElementById('currentDate').value = year + "-" + month + "-" + day;
});


//caricamento collection su index.html
function myCollection() {
    console.log("collectionName: ", GlobalCollectionName);
    document.getElementById("myCollection").innerHTML = "Collection n°: " + GlobalCollectionName;
}

//mostra sezione password per cancellazione manuale
function showInput() {
    document.getElementById("password").style.display = "inline";
    document.getElementById("emptyButton").style.display = "none";
}

//cambio schermata iniziale
async function startLeshy() {
    document.getElementById("switch-zero").style.display = "inline";
    document.getElementById("inizio").style.display = "none";
    document.getElementById("emptyButton").style.display = "none";
    document.getElementById("testomodulare").innerHTML = "Per prima cosa compilare il seguente form." +
        "I seguenti campi caratterizzeranno la collezione dei file che si vuole convertire." +
        "I campi Autore e Nome Collezione sono campi obbligatori."
}
//genera il numero della collection 
async function createUser() {
    let aut = document.getElementById("author").value;
    let na = document.getElementById("name").value;
    if (aut == "") {
        alert("Il campo Autore deve essere compilato");
    }
    else if (na == "") {
        alert("Il campo Nome deve essere compilato");
    } else {
        $.ajax({
            url: '/createUser',
            type: 'POST',
            success: function (data) {
                GlobalCollectionName = data + aut.replace(/(\n|\r|\t|\s| )/gm, "");
                console.log("Coll:", GlobalCollectionName);
                document.getElementById("switch-zero").style.display = "none";
                document.getElementById("switch-one").style.display = "block";
                document.getElementById("introduzione").innerHTML = "Di seguito è possibile caricare gruppi di file," +
                    "purchè dello stesso tipo e di dimensione non superiore a 5MB. " +
                    "I file attualmente supportati sono Docx e Docbook"
                myCollection();
            },
            error: function (err) {
                console.log("ErroreUser:", err);
            }
        });
    }
}


async function uploadToFS() {
    let fileInput = document.getElementById("filetoupload");
    if (fileInput.files.length == 0) {
        alert("Seleziona almeno un file");
    } else {
        let arrayFiles = [];
        let controlType = null;
        let controlSplit = null;
        for (let index = 0; index < fileInput.files.length; index++) {
            controlSplit = fileInput.files[index].name.split('.');
            //controllo la dimensione del file (max 5mb)
            if (fileInput.files[index].size > maxDimension) {
                return alert("Uno o più file superano la dimensione massima consentita");
            }
            else if (controlSplit[1] != "docx" && controlSplit[1] != "docbook") {
                //rimuove i dati del form
                return alert("Uno o più file non corrispondono a quelli consentiti");
            } else if (controlType == null) {
                controlType = controlSplit[1];
                arrayFiles[index] = fileInput.files[index];
            } else if (controlSplit[1] == controlType) {
                arrayFiles[index] = fileInput.files[index];
            } else {
                //rimuove i dati del form
                return alert("Uno o più file non sono dello stesso tipo");
            }
        }
        for (let index = 0; index < arrayFiles.length; index++) {
            var fd = new FormData();
            fd.append("file", arrayFiles[index]);
            fd.append("collection", GlobalCollectionName);
            $.ajax({
                url: '/uploadToFS',
                type: 'POST',
                data: fd,
                processData: false,
                contentType: false,
                success: function (res) {
                    console.log("UploadToFS  Done!")
                },
                error: function (err) {
                    console.log("ErroreUpload:", err);
                }
            });
        }
        //creo il file json con le informazioni inserite dall'utente
        let author = document.getElementById("author").value;
        let name = document.getElementById("name").value;
        let today = document.getElementById("currentDate").value;
        let description = document.getElementById("description").value;
        let notes = document.getElementById("notes").value;
        let formAutore = {
            author: author,
            name: name,
            date: today,
            description: description,
            notes: notes,
            globalCollectionName: GlobalCollectionName
        };
        $.ajax({
            url: '/createJSON',
            type: 'POST',
            data: formAutore,
            dataType: 'json',
            contentType: 'application/x-www-form-urlencoded',
            success: function (res) {
                console.log("Json creato");
            },
            error: function () {
                console.log("Errore durante la creazione del Json");
            }
        });
        document.getElementById("switch-one").style.display = "none";
        document.getElementById("switch-two").style.display = "inline";
        document.getElementById("reloadTitle").setAttribute("onclick", "reloadAndDelete()");
        document.getElementById("introduzione").innerHTML = "Sono stati estratti dai file i dati principali, ove presenti. " +
            "Prima di procedere è possibile modificarli o integrare nuove informazioni se necessario. " +
            "I seguenti dati verranno inseriti nel manifest che verrà generato al termine dell'operazione di conversione."
        setTimeout(() => { uploadFolder(); }, 2000);
    }
}

//Mostra file della cartella Upload e popola il form con i dati estratti dai file
async function uploadFolder() {
    let gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/uploadFolder',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function (data) {
            //elimino la scritta "caricamento in corso"
            document.getElementById('uploadMessage').innerHTML = "";
            let controlDoc = data[0].split('.');
            //verifico se il formato è docbook
            if (controlDoc[1] == 'docbook') {
                $.ajax({
                    url: '/sendDocbookData',
                    type: 'POST',
                    data: gc,
                    processData: false,
                    contentType: false,
                    success: function (result) {
                        populateForm(result);
                        document.getElementById("fileUploadList").style.display = "inline-block";
                    },
                    error: function (err) {
                        console.log("ErroreDocbook:", err);
                    }
                });
            }
            //se i file sono docx
            else if (controlDoc[1] == 'docx') {
                $.ajax({
                    url: '/sendDocxData',
                    type: 'POST',
                    data: gc,
                    processData: false,
                    contentType: false,
                    success: function (result) {
                        populateForm(result);
                        document.getElementById("fileUploadList").style.display = "inline-block";
                    },
                    error: function (err) {
                        console.log("ErroreDocx:", err);
                    }
                });
            }
        },
        error: function (err) {
            console.log("Errore:", err);
        }
    });
}

//genero il form e lo popolo con i dati estratti dai file
function populateForm(result) {
    let element = document.createElement('div');
    element.style.display = "table";
    element.style.margin = "10px";
    element.style.width = "100%";
    element.style.justifyContent = "space-around";
    element.style.textAlign = "center";
    let childOne = document.createElement('div');
    childOne.innerHTML = "File";
    childOne.setAttribute('class', 'textarea col-2');
    childOne.style.height = "40px";
    childOne.style.display = "table-cell";
    let childTwo = document.createElement('div');
    childTwo.innerHTML = "Titolo";
    childTwo.setAttribute('class', 'textarea col-3');
    childTwo.style.height = "40px";
    childTwo.style.display = "table-cell";
    let childThree = document.createElement('div');
    childThree.innerHTML = "Descrizione";
    childThree.setAttribute('class', 'textarea col-3');
    childThree.style.height = "40px";
    childThree.style.display = "table-cell";
    let childFour = document.createElement('div');
    childFour.innerHTML = "Anno";
    childFour.setAttribute('class', 'textarea col-2');
    childFour.style.height = "40px";
    childFour.style.display = "table-cell";
    let childFive = document.createElement('div');
    childFive.innerHTML = "Autori";
    childFive.setAttribute('class', 'textarea col-2');
    childFive.style.height = "40px";
    childFive.style.display = "table-cell";
    element.appendChild(childOne);
    element.appendChild(childTwo);
    element.appendChild(childThree);
    element.appendChild(childFour);
    element.appendChild(childFive);
    document.getElementById('listOfFiles').appendChild(element);
    for (let index = 0; index < result.length; index++) {
        let name = result[index].name.split('.')[0];
        //creo il div principale
        let element = document.createElement('div');
        element.setAttribute('class', name);
        element.style.display = "table";
        element.style.margin = "10px";
        element.style.justifyContent = "space-around";
        element.style.textAlign = "center";

        //creo il div interno
        let childOne = document.createElement('div');
        childOne.setAttribute('class', 'textarea');
        childOne.style.height = "40px";
        childOne.style.width = "15%";
        childOne.style.textWrap = "unrestricted";
        childOne.style.wordBreak = "break-all";
        childOne.style.verticalAlign = "middle";
        childOne.style.display = "table-cell";

        //creo l'input testo title
        let childTwo = document.createElement('input');
        childTwo.setAttribute('type', "text");
        childTwo.setAttribute('class', name + 'inputTitle col-3');
        childTwo.setAttribute('value', result[index].title);
        childTwo.setAttribute('name', result[index] + "inputTitle");
        childTwo.style.height = "40px";
        childTwo.style.display = "table-cell";

        //creo l'input testo desc
        let childThree = document.createElement('input');
        childThree.setAttribute('type', "text");
        childThree.setAttribute('class', name + 'inputDesc col-3');
        childThree.setAttribute('value', result[index].desc);
        childThree.setAttribute('name', result[index] + "inputDesc");
        childThree.style.height = "40px";
        childThree.style.display = "table-cell";

        //creo l'input testo year
        let childFour = document.createElement('input');
        childFour.setAttribute('type', "text");
        childFour.setAttribute('class', name + 'inputYear col-2');
        childFour.setAttribute('value', result[index].year);
        childFour.setAttribute('name', result[index] + "inputYear");
        childFour.style.height = "40px";
        childFour.style.display = "table-cell";

        //creo l'input testo authors
        let childFive = document.createElement('input');
        childFive.setAttribute('type', "text");
        childFive.setAttribute('class', name + 'inputAuthors col-2');
        childFive.setAttribute('value', result[index].authors);
        childFive.setAttribute('name', result[index] + "inputAuthors");
        childFive.style.height = "40px";
        childFive.style.display = "table-cell";

        //scrivo il nome del file nel div interno
        childOne.innerHTML = name;
        //appendo al div principale il div interno e il campo input text
        element.appendChild(childOne);
        element.appendChild(childTwo);
        element.appendChild(childThree);
        element.appendChild(childFour);
        element.appendChild(childFive);
        //appendo il div principale al div di visualizzazione su body
        document.getElementById('listOfFiles').appendChild(element);
    }
    return ("Done");
}

//Funzione JQuery file --> HTML
function toEndPage() {
    //conversione file
    var gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/toEndPage',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function (data) {
            document.getElementById("switch-two").style.display = "none";
            document.getElementById("switch-three").style.display = "inline";
            document.getElementById("reloadTitle").setAttribute("onclick", "reloadPage()");
            document.getElementById("introduzione").innerHTML = "E' ora possibile scaricare un pacchetto zip contenente i file e il manifest." +
                "Di seguito il riepilogo delle conversioni.";
            let resultTable = document.getElementById("resultTable");
            //creazione tabella contenente gli esiti della conversione
            for (let index = 0; index < data.length; index++) {
                if (data[index].split('.')[1] != 'xml') {
                    let row = document.createElement("tr");
                    row.setAttribute("class", "fileRow");
                    let fileUp = document.createElement("td");
                    fileUp.setAttribute("class", "fileUp");
                    fileUp.innerHTML = data[index].split('.')[0];
                    let fileStat = document.createElement("td");
                    fileStat.setAttribute("class", "fileStat");
                    fileStat.setAttribute("id", data[index].split('.')[0]);
                    fileStat.style.backgroundColor = "#e6b800";
                    fileStat.innerHTML = "Conversione in corso..";
                    row.appendChild(fileUp);
                    row.appendChild(fileStat);
                    resultTable.appendChild(row);
                }
            }
            //converto ogni file e in base al risultato aggiorno la tabella
            for (let index = 0; index < data.length; index++) {
                var info = new FormData();
                if (data[index].split('.')[1] != 'xml') {
                    info.append("file", data[index]);
                    info.append("collection", GlobalCollectionName);
                    $.ajax({
                        url: '/toHTML',
                        type: 'POST',
                        data: info,
                        processData: false,
                        contentType: false,
                        success: function (file) {
                            var editHtml = new FormData();
                            editHtml.append("file", file);
                            editHtml.append("collection", GlobalCollectionName);
                            $.ajax({
                                url: '/toEditHTML',
                                type: 'POST',
                                data: editHtml,
                                processData: false,
                                contentType: false,
                                success: function () {
                                    $.ajax({
                                        url: '/toRash',
                                        type: 'POST',
                                        data: editHtml,
                                        processData: false,
                                        contentType: false,
                                        success: function () {
                                            let fileStat = document.getElementById(file);
                                            fileStat.style.backgroundColor = "#009933";
                                            fileStat.innerHTML = "Terminato Correttamente";
                                        },
                                        error: function () {
                                            let fileStat = document.getElementById(file);
                                            fileStat.style.backgroundColor = "red";
                                            fileStat.innerHTML = "Non convertito";
                                        },
                                    })
                                },
                                error: function () {
                                    let fileStat = document.getElementById(file);
                                    fileStat.style.backgroundColor = "red";
                                    fileStat.innerHTML = "Non convertito";
                                },
                            })
                        },
                        error: function () {
                            let fileStat = document.getElementById(data[index].split('.')[0]);
                            fileStat.style.backgroundColor = "red";
                            fileStat.innerHTML = "Non convertito";
                        },
                        timeout: 5000
                    });
                }
            }
        },
        error: function (err) {
            console.log("ErroreEndPage:", err);
        },
    });

    //inserimento dati aggiuntivi sul json relativi ai singoli file
    $.ajax({
        url: '/uploadFolder',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function (data) {
            for (let index = 0; index < data.length; index++) {
                let name = data[index].split('.');
                let obj = {
                    name: name[0],
                    title: document.getElementsByClassName(name[0] + "inputTitle")[0].value,
                    desc: document.getElementsByClassName(name[0] + "inputDesc")[0].value,
                    year: document.getElementsByClassName(name[0] + "inputYear")[0].value,
                    authors: document.getElementsByClassName(name[0] + "inputAuthors")[0].value,
                    path: "",
                    collection: GlobalCollectionName
                }
                //singola aggiunta di ogni file
                $.ajax({
                    url: '/updateJSON',
                    type: 'POST',
                    data: obj,
                    dataType: 'json',
                    contentType: 'application/x-www-form-urlencoded',
                    success: function () {
                        console.log("UpdateJson Done!");
                    },
                    error: function (err) {
                        console.log("ErroreUpdateJson:", err);
                    }
                })
            }
        }
    })
}


//cancella la cartella upload
function deleteUpload() {
    var gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/deleteUpload',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function () {
            console.log("File upload eliminati");
        },
        error: function (err) {
            console.log("ErroreDeleteUpload:", err);
        }
    });
}

//cancella il file JSON
function deleteJSON() {
    var gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/deleteJSON',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function () {
            console.log("File json eliminato");
        },
        error: function (err) {
            console.log("ErroredeleteJson:", err);
        }
    });
}

//cancella la cartella convertiti
function deleteConverted() {
    var gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/deleteConverted',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function () {
            console.log("File convertiti eliminati");
            reloadPage();
        },
        error: function (err) {
            console.log("ErroreDeleteConverted:", err);
        }
    });
}

//Download file (e cancella le cartelle)
function download() {
    document.getElementById("downloadButton").style.display = "none";
    document.getElementById("zipCreation").style.display = "inline";
    var gc = new FormData();
    gc.append("collection", GlobalCollectionName);
    $.ajax({
        url: '/download',
        type: 'POST',
        data: gc,
        processData: false,
        contentType: false,
        success: function () {
            $.ajax({
                url: '/downloadZip',
                type: 'POST',
                data: gc,
                processData: false,
                contentType: false,
                success: function (data) {
                    var element = document.createElement('a');
                    element.setAttribute('href', data);
                    element.setAttribute('download', '');
                    element.style.display = 'none';
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                    deleteUpload();
                    deleteConverted();
                    $.ajax({
                        url: '/deleteZip',
                        type: 'POST',
                        data: gc,
                        processData: false,
                        contentType: false,
                        success: function () {
                            console.log("DeleteZip Done!");
                        },
                        error: function (err) {
                            console.log("ErrorDeleteZip:", err);
                        }
                    });
                }
            });
        },
        error: function (err) {
            console.log("ErroredeleteZip:", err);
        }
    });
}

//password per mostrare il bottone di delete
function checkPsw() {
    var pass2 = document.getElementById("password").value;
    if (pass1 == pass2) {
        document.getElementById("deleteButton").style.display = "inline";
        document.getElementById("password").style.display = "none";
    }
}
//cancellazione manuale delle cartelle e dei file
function manualDelete() {
    $.ajax({
        url: '/manualDelete',
        type: 'POST',
        success: function () {
            console.log("File eliminati manualmente");
            document.getElementById("deleteButton").style.display = "none";
            alert("File eliminati manualmente");
        },
        error: function (err) {
            console.log("ErroreManualDelete:", err);
        }
    });
}

//torna alla schermata iniziale
function reloadPage() {
    location.reload();
}
//torna alla schermata iniziale ed elimina i file upload
function reloadAndDelete() {
    deleteUpload();
    deleteJSON();
    location.reload();
}
//torna alla schermata iniziale ed elimina i file upload e convertiti
function reloadAndDeleteAll() {
    deleteUpload();
    deleteJSON();
    deleteConverted();
    location.reload();
}


