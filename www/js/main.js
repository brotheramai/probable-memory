var storyContainer;
var story;
var current;
var modules = {};

function loadModules(){
    console.log('loading modules');
    window.resolveLocalFileSystemURL(cordova.file.dataDirectory,function(dir){
        console.log(dir.fullPath);
        dir.getDirectory('modules',{create: true}, function(modules){
            console.log(modules.fullpath);
            modules.createReader().readEntries(function(entries){
                entries.forEach(e=>{ 
                    if(e.isDirectory){
                        modules[e.name] = {};
                        e.getFile('data.json',function(f){
                            f.file(function(f2){
                                var reader = new FileReader(f2);
                                reader.onload = function(){
                                    modules[e.name].data = JSON.parse(reader.result);
                                }
                            });
                        });
                        e.getFile('story.json',function(f){
                            f.file(function(f2){
                                var reader = new FileReader(f2);
                                reader.onload = function(){
                                    modules[e.name].story = JSON.parse(reader.result);
                                    console.log(modules);
                                }
                            });
                        });
                    }
                });
            });
        });
    },function(error){console.error(error)});
}

function loadConversations(){}

async function fetchModule(module){
    modules[module]= {...(await import(`./modules/${module}/custom.js`))};//the ./ at the beginning is required
    var b = document.createElement("button");
    b.innerText=module;
    b.addEventListener("click",()=>loadStory(module));
    var res = await fetch(`js/modules/${module}/story.json`);
    modules[module].storyContent = await res.text();
    return b;
}

async function initialize(id){
    storyContainer = document.getElementById(id);
    //will have to change for cordova, hardcoded for now
    loadModules();
    loadConversations();
    var module_buttons = document.createElement("ul");
    module_buttons.appendChild(await fetchModule('test'));
    module_buttons.appendChild(await fetchModule('test2'));
    storyContainer.insertAdjacentElement("beforebegin",module_buttons);
}

function loadStory(module){
    current = modules[module];
    story = new inkjs.Story(current.storyContent);
    continueStory();

}

function createStoryLine(text){
    /*
    <p class='story-line'>${text}</p>
    */
    var p = document.createElement('p');
    p.className = 'story-line';
    p.innerText = text;
    return p;
}

function createOptions(choices,click){
    /*
    <ul class='choices'>
        ... options go here
    </ul>
    */
    var container = document.createElement('ul');
    container.className='choices';
    choices.forEach(c => {
        container.appendChild(createOption(c.text,c.index,click));
    });
    return container;  
}

function createOption(text,index,click){
    /*
    <li>
        <button class="choice" onclick=${click} value="${text}" data-index="${index}">${text}</button>
    </li>
    */
    var li = document.createElement('li');
    var b = document.createElement("button");
    b.className='choice';
    b.value = text;
    b.innerText = text;
    b.setAttribute('data-index',index);
    li.appendChild(b);
    if(click){
        b.addEventListener("click",click);
    }
    return li;
}


function createList(choices,click){
    /*
    <ul class='list'>
        ... options go here
    </ul>
    */
    var container = document.createElement('ul');
    container.className='choices';
    choices.forEach(c => {
        container.appendChild(createOption(c,0,click));
    });
    return container;  
}

function continueStory(){
    while(story.canContinue){
        var p = createStoryLine(story.Continue());
        console.log(p);
        var tags = story.currentTags;
        console.log(tags);
        if(tags.length > 0){
            processTags(tags[0]);
            return;
        }
        storyContainer.appendChild(p);
    }
    if(story.currentChoices.length>0){
        var click = e=>{
            story.ChooseChoiceIndex(e.target.getAttribute('data-index'));
            e.target.setAttribute("disabled",true);
            Array.from(e.target.closest('.choices').getElementsByClassName("choice")).forEach(c=>{
                c.classList.add('not-chosen');
            })
            continueStory();
        };
        var container = createOptions(story.currentChoices,click);
        storyContainer.append(container);
    }
}
//only a function so I can return early rather than using a bunch of nested ifs
function processTags(tagsraw){
    var command;
    var command_param;
    var action;
    var target;
    (tagsraw => {
        var tags = tagsraw.split(' ');
    
        if(tags.length<1){
            return;
        }
        var params = tags[0].matchAll(/(.*?)\((.*?)\)/g).next();
        if(params.value){
            command = params.value[1];
            command_param = params.value[2];
        }
        else{
            command = tags[0];
        }
        if(tags.length<2){
            return;
        }
        action = tags[1];
        if(tags.length<3){
            return;
        }
        target = tags[2];
    })(tagsraw);
    var action = processAction(action,target);
    switch(command){
        case 'capture':
            if(command_param){
                console.error(`invalid argument ${command_param}, capture takes no arguments`);
                return;
            }
            var i = document.createElement('input');
            i.type='text';
            i.className='capture';
            storyContainer.append(i);
            i.addEventListener('change',(e)=>{
                action(e.target.value)
            });
            return;
        case 'list':
            if(!command_param){
                console.error('list requires an argument');
                return;
            }
            if(!current.variables.hasOwnProperty(command_param)){
                console.error(`could not find variable ${command_param}`);
                return;
            }
            var list = createList(current.variables[command_param],action);
            storyContainer.appendChild(list);
            return;
        case 'run':
            if(!current.hasOwnProperty(command_param)){
                console.error(`no such function ${command_param}`);
                return
            }
            current[command_param]();
            continueStory();
            return;
    }
}
/*
ACTIONS HERE
*/
function set(target){
    return (val)=>{
        current.variables[target]=val;
        continueStory();
    }
}

function setInk(target){
    return (val)=>{
        story.variablesState[target]=val;
        console.log(val);
        continueStory();
    }
}

function append(target){
    return (val)=>{
        current.variables[target].push(val.target.value);
        continueStory();
    }
}
function remove(target){
    return (val)=>{
        current.variables[target].splice(current.variables[target].indexOf(val.target.value),1);
        continueStory();
    }
}

function processAction(action, target){
    switch(action){
        case 'set':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for set action`);
                return;
            }
            return set(target);
        case 'set_ink':
            if(story.variablesState[target]==null){
                console.error(`invalid target ${target} for set_ink action`);
                return;
            }
            return setInk(target);
        case 'append':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for append action`);
                return;
            }
            if(!('push' in current.variables[target])){
                console.error(`${target} is not a valid target. append must target a list`);
                return;
            }
            return append(target);
        case 'remove':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for remove action`);
                return;
            }
            if(!('splice' in current.variables[target] &&
                ('indexOf' in current.variables[target]))){
                console.error(`${target} is not a valid target. remove must target a list`);
                return;
            }
            return remove(target);
    }
}
export {initialize}