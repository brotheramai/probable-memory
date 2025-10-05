/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

const dbname = "act";
const cnvname = "conversations";

var db;
var a;

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    var req = window.indexedDB.open(dbname,3);
    req.onsuccess = e =>{
        console.log('db open');
        db = req.result 
        loadConversations();
    }
}
function loadConversations(){
    var ul = document.getElementById('conversations');
    const trans = db.transaction([cnvname]);
    var req = trans.objectStore(cnvname).openCursor();
    req.onsuccess = e =>{
        const c = e.target.result;
        if(c){
            ul.appendChild(createConversation(c.key,c.value));
            c.continue();
        }
        else{
            
        }
    }   
}

function createConversation(id,cnv){
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.setAttribute('href',`conversation.html?cnv=${id}`);
    a.innerText = `${cnv.topic}(${cnv.contact})`;
    li.appendChild(a);
    return li;
}