//SETUP & CONFIG
const express = require('express');
const path = require('path');
const pandoc = require('node-pandoc');
const fs = require('fs');
const zipper = require('zip-local');
const unzipper = require('unzipper');
const fileUpload = require('express-fileupload');
const del = require('del');
const xpath = require('xpath');
const DOMParser = require('xmldom').DOMParser;
const promises = require('stream-promise');
const directory = require('unzipper/lib/Open/directory');
const xmlParse = require('xslt-processor').xmlParse;
const xsltProcess = require('xslt-processor').xsltProcess;
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 8080;


//indirizzo server per il download dei file convertiti
const urlFolder = "http://localhost:8080/";

//massimo numero di caratteri per docx
const maxCharacters = 120000;

//ROUTING
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/views'));
app.use('/views', express.static(__dirname + '/views'));
app.use('/', express.static(__dirname));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'tmp'),
  preserveExtension: true,
}));

//INDEX.HTML
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/views/index.html'));
});
//CANCELLAZIONE CARTELLA (CON DEL CHE ELIMINA TUTTE LE SOTTOCARTELLE)
function deleteFolder(directory) {
  console.log("Delete folder");
  fs.readdir(directory, (err, files) => {
    if (err) throw err;
    //cancella le cartelle ricorsivamente
    (async () => {
      try {
        await del(directory);
      } catch (err) {
        console.error(`Errore durante la cancellazione di ${directory}.`);
      }
    })();
  });
}
//CREAZIONE JSON (MANIFEST)
app.post('/createJSON', async function (req, res) {
  let collectionName = req.body.globalCollectionName;
  var data = {
    author: req.body.author,
    collection_name: req.body.name,
    collection: req.body.collection,
    date: req.body.date,
    description: req.body.description,
    notes: req.body.notes,
    docs: []
  }
  var jsonData = JSON.stringify(data);
  fs.writeFileSync(collectionName + ".json", jsonData, function (err) {
    if (err) {
      console.log(err);
    }
  });
  res.send(true);
})

//AGGIORNAMENTO JSON CON I DATI DEI SINGOLI FILE
app.post('/updateJSON', async function (req, res) {
  let name = req.body.name;
  let title = req.body.title;
  let authors = req.body.authors;
  let year = req.body.year;
  let path = req.body.path;
  let desc = req.body.desc;
  let collection = req.body.collection;
  let object = {
    name: name,
    title: title,
    desc: desc,
    year: year,
    authors: authors,
    path: path
  }
  //seleziono il json
  let jsonToUpdate = fs.readFileSync(collection + ".json", "utf-8");
  //converto in array
  let jsonArray = JSON.parse(jsonToUpdate)
  //aggiungo i nuovi dati
  jsonArray.docs.push(object);
  //scrivo e salvo il file
  jsonToUpdate = JSON.stringify(jsonArray);
  fs.writeFileSync(collection + ".json", jsonToUpdate, "utf-8");
  res.send(true);
})

//CARICAMENTO FILE CON FS
app.post('/uploadToFS', async function (req, res) {
  let targetFile = req.files.file;
  let fileName = targetFile.name;
  fileName = fileName.toString().split('.');
  fileName[0] = fileName[0].replace(/ /g, '');
  let directoryUpload = __dirname + "/" + req.body.collection;
  try {
    //verifica l'esistenza della cartella
    if (!fs.existsSync(directoryUpload)) {
      fs.mkdirSync(directoryUpload)
    }
    targetFile.mv(directoryUpload + "/" + fileName[0] + "." + fileName[1], err => {
      if (err)
        return res.status(500).send(err);
      res.send('File uploaded!');
    });
  } catch (err) {
    console.error(err)
  }
});

//DATI PER LA CREAZIONE DELLA SCHERMATA FINALE
app.post('/toEndPage', function (req, res) {
  //Passaggio percorso cartella e callback
  let uploadFolder = req.body.collection;
  let directoryUpload = __dirname + "/" + uploadFolder;
  let files = fs.readdirSync(directoryUpload, function (err, files) {
    //Errore di scansione
    if (err) {
      return console.log('Impossibile scansionare la cartella: ' + err);
    }
    if (files[0] == null) {
      return console.log("Nessun file presente nella cartella");
    } else {
      return files;
    }
  });
  //creo la cartella in cui salvare le conversioni
  fs.mkdirSync(directoryUpload + 'converted');
  res.send(files);
});

//OPERAZIONI PANDOC
//--> HTML
app.post('/toHtml', function (req, res) {
  let uploadFolder = req.body.collection;
  let directoryUpload = __dirname + "/" + uploadFolder;
  let filename = req.body.file;
  let filetype = filename.split('.');
  filetype[0] = filetype[0].replace(/\s+/g, '').trim();
  //convertitore PANDOC per DOCX e DOCBOOK
  //controllo che i file siano supportati da pandoc
  if (filetype[1] == 'docx' || filetype[1] == 'docbook') {
    //creo la cartella per contenere il singolo file convertito
    fs.mkdirSync(directoryUpload + 'converted/' + filetype[0]);
    //creo il percorso del file per il convertitore
    var src = './' + uploadFolder + '/' + filename;
    var destination = uploadFolder + "converted/" + filetype[0] + "/";
    //ogni file è contenuto in una sottocartella con il nome del file da convertire
    if (filetype[1] == 'docbook') {
      var args = '-f docbook' + ' -t html -o ' + destination + filetype[0] + ".html" +
        ' --section-divs --standalone --extract-media=' + uploadFolder + 'converted/' + filetype[0];
    } else {
      var args = '-f ' + filetype[1] + ' -t html -o ' + destination + filetype[0] + ".html" +
        ' --section-divs --standalone --extract-media=' + uploadFolder + 'converted/' + filetype[0];
    }
    //funzione di callback
    callback = function (err, result) {
      if (err) {
        console.error('Oh No: ', err);
      }
      else {
        console.log(result);
        return res.send(filetype[0]);
      }
    };
    //chiamata pandoc
    pandoc(src, args, callback);
    console.log("...Fatto!");
  }
});


//funzione per l'estrazione del numero di caratteri dai file docx 
async function testCharacters(filetype0,filetype1, directoryUpload, filename) {
  if (filetype1 == "docx") {
    let app = directoryUpload + '/' + filetype0 + 'app.xml';
    let promise = promises(fs.createReadStream(directoryUpload + '/' + filename)
      .pipe(unzipper.ParseOne('.*/app.xml'))
      .pipe(fs.createWriteStream(app)))
    //eseguo la lettura del file per la verifica del numero di pagine
    await promise.then(() => {
      let reader = fs.readFileSync(app, 'utf-8', function (err, data) {
        if (err) {
          console.log(err)
        } else {
          return (data);
        }
      })
      reader = reader.toString();
      fs.unlinkSync(directoryUpload + "/" + filetype0 + "app.xml")
      let controller = reader.search("<Characters>");
      if (controller != -1) {
        return (reader.split("<Characters>").pop().split("</Characters>")[0]);
      } else {
        return (maxCharacters + 1);
      }
    })
  } else {
    return (0);
  }
}

//CANCELLA CARTELLA UPLOAD
app.post('/deleteUpload', async function (req, res) {
  //cancello i file nella cartella di upload
  let directoryUpload = __dirname + "/" + req.body.collection;
  deleteFolder(directoryUpload);
  res.send("Upload Cancellati");
});

//CANCELLA IL FILE JSON
app.post('/deleteJSON', async function (req, res) {
  fs.unlinkSync(__dirname + "/" + req.body.collection + ".json");
  res.send("Manifest Cancellato");
})

//CANCELLA IL FILE ZIP DAL SERVER
app.post('/deleteZip', async function (req, res) {
  let collection = req.body.collection;
  setTimeout(() => { fs.unlinkSync(__dirname + "/" + collection + ".zip") }, 10000);
  res.send("Zip Cancellato");
})

//CANCELLA CARTELLA CONVERTED
app.post('/deleteConverted', async function (req, res) {
  //cancello i file nella cartella di upload
  let directoryConv = __dirname + "/" + req.body.collection + "converted";
  deleteFolder(directoryConv);
  res.send("Converted Cancellati");
});

//FUNZIONI CARICAMENTO
//creazione numero Collection
function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}

//CREAZIONE COLLECTION
app.post('/createUser', async function (req, res) {
  let collectionName = randomInt(0, 1000000).toString();
  console.log("CollectionName:", collectionName);
  res.send(collectionName);
})


//MOSTRA IL CONTENUTO DELLA CARTELLA DI UPLOAD 
app.post('/uploadFolder', async function (req, res) {
  let directoryUpload = __dirname + "/" + req.body.collection;
  fs.readdir(directoryUpload, function (err, files) {
    //Errore di scansione
    if (err) {
      return console.log('Impossibile scansionare la cartella: ' + err);
    }
    if (files[0] == null) {
      return console.log("Nessun file presente nella cartella");
    } else {
      //Scorro tutti i file
      var fileList = [];
      for (let index = 0; index < files.length; index++) {
        if (files[index].split('.')[1] != 'xml') {
          fileList.push(files[index]);
        }
      }
    }
    res.send(fileList);
  });
})

//ESTRAZIONE DATI DA FILE DOCX
app.post('/sendDocxData', async function (req, res) {
  //converte docx in html 
  let directoryUpload = __dirname + "/" + req.body.collection;
  var fileList = [];
  let files = fs.readdirSync(directoryUpload, function (err, files) {
    //Errore di scansione
    if (err) {
      return console.log('Impossibile scansionare la cartella: ' + err);
    }
    if (files[0] == null) {
      return console.log("Nessun file presente nella cartella");
    } else {
      return files;
    }
  });
  fileList.length = files.length;
  //funzione che estrare i dati dai core e salva tutto nella lista 
  await extractFromCore(directoryUpload, files, fileList);
  res.send(fileList);
})

//funzione per estrarre i dati dal core di Docx
async function extractFromCore(directoryUpload, files, fileList) {
  for (let index = 0; index < files.length; index++) {
    //creo il percorso del file core.xml
    let core = directoryUpload + '/' + files[index].split('.')[0] + '.xml';
    //estraggo il file core.xml dal docx
    let promise = promises(fs.createReadStream(directoryUpload + '/' + files[index])
      .pipe(unzipper.ParseOne('.*/core.xml'))
      .pipe(fs.createWriteStream(core)))
    //eseguo la lettura del file e l'estrazione/salvataggio dei dati
    await promise.then(() => {
      let reader = fs.readFileSync(core, 'utf-8', function (err, data) {
        if (err) {
          console.log(err)
        } else {
          return (data);
        }
      })
      reader = reader.toString();
      let title = "";
      let controller = reader.search("<dc:title>")
      if (controller != -1) {
        title = reader.split("<dc:title>").pop().split("</dc:title>")[0];
      }
      let desc = "";
      controller = reader.search("<dc:description>")
      if (controller != -1) {
        desc = reader.split("<dc:description>").pop().split("</dc:description>")[0];
      }
      let year = "";
      controller = reader.search("<dcterms:created")
      if (controller != -1) {
        year = reader.split("<dcterms:created").pop().split("</dcterms:created>")[0];
        year = year.split(">")[1];
      }
      let authors = "";
      controller = reader.search("<dc:creator>")
      if (controller != -1) {
        authors = reader.split("<dc:creator>").pop().split("</dc:creator>")[0];
      }
      const expression = {
        name: files[index],
        title: title,
        desc: desc,
        authors: authors,
        year: year.substring(0, 4)
      }
      fileList[index] = expression;
    })
  }
  return fileList;
}

//ESTRAZIONE DATI DA FILE DOCBOOK
app.post('/sendDocbookData', async function (req, res) {
  let directoryUpload = __dirname + "/" + req.body.collection;
  fs.readdir(directoryUpload, async function (err, files) {
    //Errore di scansione
    if (err) {
      return console.log('Impossibile scansionare la cartella: ' + err);
    }
    if (files[0] == null) {
      return console.log("Nessun file presente nella cartella");
    } else {
      var fileList = [];
      fileList.length = files.length;
      //Scorro tutti i file
      for (let index = 0; index < files.length; index++) {
        let reader = fs.readFileSync(directoryUpload + '/' + files[index], 'utf-8', function (err, data) {
          if (err) {
            console.log(err)
          } else {
            return data;
          }
        })
        var parser = new DOMParser();
        var doc = parser.parseFromString(reader, 'text/xml');
        //modifica del file docbook
        let info = doc.getElementsByTagName('info');
        for (let i = 0; i < info.length; i++) {
          info[i].tagName = info[i].tagName.replace(/info/g, "chapter");
        }
        let biblio = doc.getElementsByTagName('bibliomixed');
        for (let i = 0; i < biblio.length; i++) {
          biblio[i].tagName = biblio[i].tagName.replace(/bibliomixed/g, "section");
        }
        //sostituzione dell'immagine se l' URL non  è valido
        let img = doc.getElementsByTagName('imagedata');
        for (let i = 0; i < img.length; i++) {
          let testURL = img[i].getAttribute("fileref");
          if (isUrl(testURL) == false) {
            img[i].setAttribute("fileref", "media/default.png")
          } else {
            await fetch(testURL).then(response => {
              if (response.ok) {
              } else {
                img[i].setAttribute("fileref", "media/default.png")
                throw 'URL non valido, sostituito con immaginedi default';
              }
            }).
              catch(error => {
                console.log("URL non valido, sostituito con immaginedi default");
                img[i].setAttribute("fileref", "media/default.png")
              });
          }
        }
        //scrittura del file modificato
        fs.writeFileSync(directoryUpload + '/' + files[index].split('.')[0] + '.docbook', doc.toString(), 'UTF-8')

        //estrazione dei metadati
        const titleArray = xpath.select('//*[local-name() = \'title\']//text()', doc)
        const descArray = xpath.select('//*[local-name() = \'subtitle\']//text()', doc)
        const year = xpath.select('string(//*[local-name() = \'confdates\'])', doc)
        const authors = xpath.select('//*[local-name() = \'personname\']//text()', doc)
        let authorsString = '';
        let authorsArray = [];
        authors.forEach(item => {
          if (item.data != null) {
            authorsString = item.data.replace(/(\n|\r|\t|\s| )/gm, "");
            if (authorsString != '') {
              authorsArray.push(authorsString);
            }
          }
        })
        authorsString = '';
        for (item of authorsArray) {
          authorsString += item + ' ';
        }
        if (titleArray[0] != null) {
          var title = titleArray[0].data.replace(/\n|\t/g, ' ')
        }
        var desc = (descArray[0] && descArray[0].data) ? descArray[0].data.replace(/\n|\t/g, '') : 'description unavailable'
        const expression = {
          name: files[index],
          title: title,
          desc: desc,
          authors: authorsString,
          year: year.substring(year.length - 4, year.length)
        }

        fileList[index] = expression;
      }
    }
    res.send(fileList);
  });
})

//verifica se la stringa è un URL
function isUrl(string) {
  try { return Boolean(new URL(string)); }
  catch (e) { return false; }
}

//MODIFICA HTML PRIMA DI CONVERTIRE IN RASH
app.post('/toEditHTML', async function (req, res) {
  let file = req.body.file;
  let collection = req.body.collection;
  let destination = __dirname + "/" + collection + "converted/" + file + "/";
  let htmlEdit;
  try {
    htmlEdit = fs.readFileSync(destination + file + ".html", 'utf8');
  }
  catch {
    res.sendStatus(404);
  }
  if (htmlEdit != null) {
    //rimuovo commenti dal file html
    htmlEdit = htmlEdit.replace(/<!--.*?-->/sg, "");
    var parser = new DOMParser();
    let doc = parser.parseFromString(htmlEdit, "text/html")
    let images = doc.getElementsByTagName('img');
    let col = doc.getElementsByTagName('col');
    let headAtt = doc.getElementsByTagName('head');
    let style = doc.getElementsByTagName('style');
    let htmlAtt = doc.getElementsByTagName('html');
    //rimuovo style
    if (headAtt) {
      headAtt[0].removeChild(style[0]);
    }
    for (let j = 0; j < col.length; j++) {
      if (col[j].getAttribute("style") != null) {
        col[j].removeAttribute("style");
      }
    }
    //modifica della src per ogni immagine 
    for (let j = 0; j < images.length; j++) {
      let newSrc = images[j].getAttribute('src');
      if (images[j].getAttribute("style") != null) {
        images[j].removeAttribute("style");
      }
      newSrc = newSrc.split("converted/" + file + "/")[1];
      if (newSrc.startsWith("media/")) {
        images[j].setAttribute('src', newSrc);
      }
      else {
        /*sposto l'immagine nella cartella media, Pandoc inserisce le immagini provenienti da Browser 
        nella cartella del file e non nella sottocartella media*/
        images[j].setAttribute('src', "media/" + newSrc);
        let imageSrc = destination + newSrc;
        let newPath = destination + "media/" + newSrc;
        fs.renameSync(imageSrc, newPath, function (err) {
          if (err) throw err
          console.log('Immagine spostata nella cartella media')
        })
      }
      //rimuovo gli attributi vuoti
      if (htmlAtt) {
        htmlAtt[0].removeAttribute('xmlns');
        htmlAtt[0].removeAttribute('lang');
        htmlAtt[0].removeAttribute('xml:lang');
      }
    }
    fs.writeFileSync(destination + file + ".html", doc.toString(), "utf-8")
    res.send(true);
  }
})

//funzione che converte un file HTLM in RASH
app.post('/toRash', async function (req, res) {
  let destination = __dirname + "/" + req.body.collection + "converted/" + req.body.file + "/";
  let xsltString = fs.readFileSync(__dirname + "/doc/pandoc2rash.xsl", "utf-8", function (err, data) {
    if (err) {
      console.log("File XSL non trovato", err)
    } else {
      return data.toString();
    }
  });
  let xmlString = fs.readFileSync(destination + req.body.file + ".html", "utf-8", function (err, data) {
    if (err) {
      console.log("File HTML non trovato", err)
    } else {
      return data.toString();
    }
  });
  const outXmlString = xsltProcess(
    xmlParse(xmlString),
    xmlParse(xsltString)
  )
  fs.writeFileSync(destination + req.body.file + "_rash.html", outXmlString, "utf-8");
  res.send(convertedFolder(destination, req.body.collection));
});



//funzione che aggiunge il percorso del file correttamente convertito al manifest
async function convertedFolder(destination, collection) {
  let result = fs.readdirSync(destination, function (err, data) {
    //Errore di scansione
    if (err) {
      return console.log('Impossibile scansionare la cartella: ' + err);
    }
    if (data == null) {
      return console.log("Nessun file presente nella cartella");
    } else {
      return data;
    }
  })
  //se la cartella non è vuota aggiungo il percorso del file e lo modifico
  let filetoUse = await checkRASH(result, destination);
  filetoUse = filetoUse.toString();
  //funzione che aggiunge il percorso del file rash al manifest
  return (updatePath(filetoUse, destination, collection));
}

//verifica che ci sia un file rash.html ed elimina gli altri file
async function checkRASH(result, pathOfFile) {
  let rashFile = "";
  for (let k = 0; k < result.length; k++) {
    if (result[k].endsWith("_rash.html")) {
      rashFile = result[k];
    } else if (result[k].endsWith(".html")) {
      fs.unlinkSync(pathOfFile + "/" + result[k]);
    }
  }
  return (rashFile);
}
//INSERISCE PATH DEI FILE CONVERTITI IN JSON
function updatePath(name, path, collection) {
  //seleziono il json
  let jsonToUpdate = fs.readFileSync(collection + ".json", "utf-8");
  //converto in array
  let jsonArray = JSON.parse(jsonToUpdate)
  //aggiungo il nuovo dato
  for (let index = 0; index < jsonArray.docs.length; index++) {
    if (jsonArray.docs[index].name + "_rash.html" == name) {
      jsonArray.docs[index].path = path + name;
      index = jsonArray.docs.length;
    }
  }
  //scrivo e salvo il file
  jsonToUpdate = JSON.stringify(jsonArray);
  fs.writeFileSync(collection + ".json", jsonToUpdate, "utf-8");
  return true;
}

//DOWNLOAD FILE 
app.post('/download', async function (req, res) {
  let fileName = req.body.collection;
  let directoryConv = __dirname + "/" + fileName + "converted";
  //rimozione dei file con path vuoto dal manifest
  //seleziono il json
  let jsonToUpdate = fs.readFileSync(req.body.collection + ".json", "utf-8");
  //converto in array
  let jsonArray = JSON.parse(jsonToUpdate);
  for (let index = 0; index < jsonArray.docs.length; index++) {
    if (jsonArray.docs[index].path == '') {
      console.log("JsonPathEmpty");
      //elimina l'elemento contenente path vuoto dal manifest 
      fs.rmSync(directoryConv+"/"+jsonArray.docs[index].name, { recursive: true, force: true });
      jsonArray.docs.splice(index, 1);
    }
  }
  jsonToUpdate = JSON.stringify(jsonArray);
  //riscivo il JSON nella cartella contenente anche i file
  fs.writeFileSync(directoryConv + "/" + fileName + '.json', jsonToUpdate, "utf-8");
  res.send("Done");
});


//crea il file zip 
app.post('/downloadZip', async function(req, res){
  let fileName = req.body.collection;
  let directoryConv = __dirname + "/" + fileName + "converted";
  let sendDownload = await zipFolder(directoryConv, fileName);
  //elimino il vecchio json
  fs.unlinkSync(req.body.collection + ".json");
  res.send(sendDownload);
})

//funzione per zippare la cartella
async function zipFolder(directoryConv, fileName) {
  return new Promise(resolve => {
    zipper.sync.zip(directoryConv).compress().save(fileName + ".zip")
    let fileToDownload = __dirname + "/" + fileName + ".zip";
    console.log("fileToDownload:", fileToDownload);
    resolve(urlFolder + fileName + ".zip");
  })
}

//ELIMINAZIONE CARTELLE MANUALE (ADMIN)
app.post('/manualDelete', function (req, res) {
  fs.readdir(__dirname, function (err, files) {
    for (let index = 0; index < files.length; index++) {
      //controllo che la cartella inizi con un numero (quindi fa parte delle cartelle da cancellare)
      if (files[index].match(/^\d/)) {
        if (path.extname(files[index]) == ".json" || path.extname(files[index]) == ".zip") {
          fs.unlinkSync(files[index]);
        } else {
          deleteFolder(files[index]);
        }
      }
    }
  })
  res.send("Done");
})


//SERVER START
app.listen(port);
console.log('Server started at https://localhost/' + port);

