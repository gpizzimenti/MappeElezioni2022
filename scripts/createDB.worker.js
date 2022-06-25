
self.onmessage = function (msg) {
    let result = {};

  
    try {
        result.db = self.createDB(msg.data);
        result.result = true;
    } catch (exc) {
      result.result = false;
      result.msg = exc;
      console.error(exc);
    } finally {
      self.postMessage(result);
    }
    
};

  self.createDB = function createDB(data) { 
    const db = {};

    data.sezioni.features.forEach((sezione)=>{

      const key = sezione.geometry.coordinates[0]+"-"+sezione.geometry.coordinates[1];

      let processedData = db[key] || {
        "latlng" : sezione.geometry.coordinates,
        "nome": sezione.properties.title,
        "sezioni": [],
        "sindaci": JSON.parse(JSON.stringify(data.dizionario_sindaci)),
        "liste": JSON.parse(JSON.stringify(data.dizionario_liste)),
        "totali" : {
          "elettori": 0,
          "votanti": 0,
          "bianche": 0,          
          "nulli": 0,                    
          "contestazioni": 0,                    
          "voti_sindaco": 0,
          "voti_lista": 0
        }
      };

      data.sindaci.filter((el)=>{
        return el["Sezione"] == sezione.properties.id;
      }).forEach((sindaco)=>{
        let  idSindaco =  sindaco["Numero Sind"],
             voti_validi =  parseInt(sindaco["Voti validi"],10),
             tot = parseInt(processedData.sindaci[idSindaco].voti,10);

        if (tot)
          processedData.sindaci[idSindaco].voti = tot + voti_validi;
        else  
          processedData.sindaci[idSindaco].voti = voti_validi;

          processedData.totali.voti_sindaco += voti_validi;
      });

      data.votanti.filter((el)=>{
        return el["Sezione"] == sezione.properties.id;
      }).forEach((sezione)=>{
        let  elettori =  parseInt(sezione["Elettori"],10),
             votanti =  parseInt(sezione["Votanti"],10);

          processedData.totali.elettori += elettori;
          processedData.totali.votanti += votanti;
      });

      data.bianche_nulli_contestazioni.filter((el)=>{
        return el["Sezione"] == sezione.properties.id;
      }).forEach((sezione)=>{
        let  bianche =  parseInt(sezione["Schede bianche"],10),
             nulli =  parseInt(sezione["Schede nulle"],10),
             contestazioni =  parseInt(sezione["V.Cont.NoAss."],10);

          processedData.totali.bianche += bianche;
          processedData.totali.nulli += nulli;
          processedData.totali.contestazioni += contestazioni;
      });


      data.liste.filter((el)=>{
        return el["Sezione"] == sezione.properties.id;
      }).forEach((lista)=>{
        let  idLista =  lista["Numero Liste"],
             voti_validi =  parseInt(lista["Voti validi"],10),
             tot = parseInt(processedData.liste[idLista].voti,10);

        if (tot)
          processedData.liste[idLista].voti = tot + voti_validi;
        else  
          processedData.liste[idLista].voti = voti_validi;

          processedData.totali.voti_lista += voti_validi;          
      });      

     
      processedData.sezioni.push(sezione.properties.id);

      db[key]=processedData;
    });


    //indexing && grouping

    for (let idSezione in db) {
     const sezione =  db[idSezione];
     sezione.sindaciSorted = [];
     sezione.listeSorted = [];

     for (let idSindaco in sezione.sindaci) {
      const sindaco = sezione.sindaci[idSindaco];
      sezione.sindaciSorted.push(sindaco);
      sindaco.perc =  (sezione.totali.voti_sindaco>0 && sindaco.voti>0)  ? parseFloat(((sindaco.voti/sezione.totali.voti_sindaco)*100).toFixed(2)) : 0;
     }  
     
     sezione.sindaciSorted = sezione.sindaciSorted.sort((a,b) => {return b.voti - a.voti}); 

     for (let idLista in sezione.liste) {
      const lista = sezione.liste[idLista];
      sezione.listeSorted.push(lista);
      lista.perc =  (sezione.totali.voti_lista>0 && lista.voti>0)  ? parseFloat(((lista.voti/sezione.totali.voti_lista)*100).toFixed(2)) : 0;
     }  
     
     sezione.listeSorted = sezione.listeSorted.sort((a,b) => {return b.voti - a.voti}); 

    }

//console.log(db);
    return db;
  };  