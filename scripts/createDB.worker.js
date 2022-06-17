
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
        "totali" : {
          "elettori": 0,
          "votanti": 0,
          "voti_sindaco": 0
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
     
      processedData.sezioni.push(sezione.properties.id);

      db[key]=processedData;
    });


    //indexing && grouping

    for (let idSezione in db) {
     const sezione =  db[idSezione];
     sezione.sindaciSorted = [];

     for (let idSindaco in sezione.sindaci) {
      const sindaco = sezione.sindaci[idSindaco];
      sezione.sindaciSorted.push(sindaco);
      sindaco.perc =  (sezione.totali.voti_sindaco>0 && sindaco.voti>0)  ? parseFloat(((sindaco.voti/sezione.totali.voti_sindaco)*100).toFixed(2)) : 0;
     }  
     
     sezione.sindaciSorted = sezione.sindaciSorted.sort((a,b) => {return b.voti - a.voti}); 
    }

console.log(db);

    return db;
  };  