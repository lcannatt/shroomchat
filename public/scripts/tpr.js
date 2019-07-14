'use strict';

var TPR_GEN = function (){


	//  @MARK adding a cookie setter helper function
	//  using nonstandard word 'delta' for the time from d.getTime() from which the cookie will expire
	//  normally I'd be a little hesitant to remove generality from the user setting a cookie to expire whenever,
	//  instead of locking him down to a difference from right now, but this way is a lot easier for usage,
	//  and I can't think of when you'd want to set a specific datetime for cookie expiry as opposed to a delta.
	var setCookie = function(name, value, delta, path) {
		var d = new Date();
		d.setTime(d.getTime() + delta);
		document.cookie = name + "=" + value + ";" + "expires=" + d.toUTCString() + ";path=" + path;
	}

	//  GENERIC ELEMENT CREATION WRAPPER
	// 	Behavior: 	* Creates new element with tag name of @Param tagName
	//				* Copies all enumerable properties of @Param properties (json object) to new element
	//				* Returns element object.
	var newElement = function(tagName,properties){
		let elem=document.createElement(tagName);
		for(var property in properties){
			elem[property]=properties[property];
		}
		return elem;
	}

	return{
		setCookie : function(name, value, delta, path){
			return setCookie(name, value, delta, path);
		},
		newElement : function(tagName,properties){
			return newElement(tagName,properties);
		}
	}
}();
